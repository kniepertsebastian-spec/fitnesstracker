import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { GeneratePlanRequest, GeneratePlanResponse } from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { decryptSecret } from "../../lib/crypto.js";
import { ConflictError } from "../../errors/httpErrors.js";
import { toPlanExerciseDto } from "../trainingPlan/planExercise.types.js";
import { AiProviderError, callChatCompletion } from "./aiClient.js";
import {
  buildColdStartContext,
  buildSystemPrompt,
  buildWarmStartContext,
  estimateWeeklyFrequency,
  resolveSplitDays,
  selectCatalogSubset,
} from "./promptBuilder.js";

// Below this many logged sets, there isn't enough real history to build a useful "warm start"
// prompt (best lifts, etc.) — the frontend needs to collect cold-start answers instead.
const MIN_LOGGED_SETS_FOR_WARM_START = 5;
// 6 split days * up to ~8 exercises each, with some slack for the model overshooting the
// requested 6-per-day — validated/filtered down to real catalog matches afterwards regardless.
const MAX_PLAN_ITEMS = 60;

const aiPlanItemSchema = z.object({
  day: z.string(),
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().positive().max(20),
  targetReps: z.number().int().positive().max(100),
  order: z.number().int().min(0),
});
const aiPlanResponseSchema = z.object({ items: z.array(aiPlanItemSchema).min(1).max(MAX_PLAN_ITEMS) });

async function hasEnoughHistory(prisma: PrismaClient, userId: string): Promise<boolean> {
  const count = await prisma.workoutLog.count({ where: { userId, deletedAt: null } });
  return count >= MIN_LOGGED_SETS_FOR_WARM_START;
}

// `baseUrlOverride` only exists to let the pipeline be verified against a local stub server
// without a real provider key — see ARCHITECTURE.md's Phase 19 section. Never set in production.
export async function generatePlan(
  prisma: PrismaClient,
  userId: string,
  input: GeneratePlanRequest,
  options?: { baseUrlOverride?: string },
): Promise<GeneratePlanResponse> {
  const enoughHistory = await hasEnoughHistory(prisma, userId);
  if (!enoughHistory && !input.coldStart) {
    return { status: "needs_cold_start" };
  }

  if (!env.AI_SETTINGS_ENCRYPTION_KEY) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert");
  }
  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  if (!setting) {
    throw new ConflictError("Noch kein KI-Anbieter konfiguriert — zuerst einen API-Key hinterlegen");
  }
  const apiKey = decryptSecret(setting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY);

  const catalog = await selectCatalogSubset(prisma, userId, input.coldStart ?? null);
  if (catalog.length === 0) {
    throw new ConflictError("Keine passenden Übungen für diese Vorgaben gefunden");
  }
  const catalogIds = new Set(catalog.map((c) => c.id));

  // Cold start already asked "how often do you train"; warm start never did, so the frequency
  // (and with it, the split structure) is estimated from actual recent logging cadence instead.
  const frequencyPerWeek = input.coldStart
    ? input.coldStart.frequencyPerWeek
    : await estimateWeeklyFrequency(prisma, userId);
  const splitDays = resolveSplitDays(frequencyPerWeek);

  const context = input.coldStart
    ? buildColdStartContext(input.coldStart)
    : await buildWarmStartContext(prisma, userId);
  const systemPrompt = buildSystemPrompt(input.phase, catalog, splitDays);

  const rawContent = await callChatCompletion(
    setting.provider,
    apiKey,
    setting.model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: context },
    ],
    options,
  );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch {
    throw new AiProviderError("Antwort des KI-Anbieters war kein gültiges JSON");
  }

  const parsed = aiPlanResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new AiProviderError("Antwort des KI-Anbieters entsprach nicht dem erwarteten Format");
  }

  // Defense in depth, two checks: an item can pass the UUID-shape check above and still be a
  // hallucinated ID that was never actually offered in the prompt's catalog, or a "day" value
  // the model invented instead of using one of the exact split-day names it was given — either
  // is dropped rather than trusted.
  const validItems = parsed.data.items.filter(
    (item) => catalogIds.has(item.exerciseId) && splitDays.includes(item.day),
  );
  if (validItems.length === 0) {
    throw new AiProviderError("Der KI-Anbieter hat keine gültigen Übungen aus dem Katalog gewählt");
  }

  // Group by day, sorted within each day by the model's own `order` (trusted only for
  // within-day sequence, not as a final cross-day index). The written `order` is a single
  // counter incrementing across the *whole* write, day by day — not reset to 0 per day — so
  // that the existing `listPlanExercises` GET endpoint (a plain `ORDER BY order ASC`, which
  // knows nothing about split days) still returns entries in the correct day-major sequence
  // with no query changes needed there.
  const itemsByDay = new Map<string, typeof validItems>();
  for (const item of validItems) {
    const bucket = itemsByDay.get(item.day) ?? [];
    bucket.push(item);
    itemsByDay.set(item.day, bucket);
  }
  let order = 0;
  const rowsToCreate = splitDays.flatMap((day) => {
    const dayItems = (itemsByDay.get(day) ?? []).sort((a, b) => a.order - b.order);
    return dayItems.map((item) => ({
      userId,
      phase: input.phase,
      exerciseId: item.exerciseId,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      order: order++,
      // Single-day plans ("Ganzkörper") leave dayLabel null — there's nothing to group by with
      // only one day, same as a manually curated phase.
      dayLabel: splitDays.length > 1 ? day : null,
    }));
  });

  // Replaces the phase's existing plan rather than appending — "einen Plan generieren" means a
  // fresh plan for that phase, not accumulating alongside whatever was manually curated before.
  const entries = await prisma.$transaction(async (tx) => {
    await tx.planExercise.deleteMany({ where: { userId, phase: input.phase } });
    await tx.planExercise.createMany({ data: rowsToCreate });
    // Plain `order ASC` is enough — `order` is already a single counter incrementing day by
    // day across the whole write above, so this naturally comes back in day-major sequence.
    return tx.planExercise.findMany({
      where: { userId, phase: input.phase },
      orderBy: { order: "asc" },
      include: { exercise: true },
    });
  });

  return { status: "generated", items: entries.map(toPlanExerciseDto) };
}
