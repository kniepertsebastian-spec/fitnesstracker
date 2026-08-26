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
  selectCatalogSubset,
} from "./promptBuilder.js";

// Below this many logged sets, there isn't enough real history to build a useful "warm start"
// prompt (best lifts, etc.) — the frontend needs to collect cold-start answers instead.
const MIN_LOGGED_SETS_FOR_WARM_START = 5;

const aiPlanItemSchema = z.object({
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().positive().max(20),
  targetReps: z.number().int().positive().max(100),
  order: z.number().int().min(0),
});
const aiPlanResponseSchema = z.object({ items: z.array(aiPlanItemSchema).min(1).max(15) });

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

  const context = input.coldStart
    ? buildColdStartContext(input.coldStart)
    : await buildWarmStartContext(prisma, userId);
  const systemPrompt = buildSystemPrompt(input.phase, catalog);

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

  // Defense in depth: an item can pass the UUID-shape check above and still be a hallucinated ID
  // that was never actually offered in the prompt's catalog — filter those out rather than
  // trusting the model to have honored the "only these IDs" instruction.
  const validItems = parsed.data.items
    .filter((item) => catalogIds.has(item.exerciseId))
    .sort((a, b) => a.order - b.order);
  if (validItems.length === 0) {
    throw new AiProviderError("Der KI-Anbieter hat keine gültigen Übungen aus dem Katalog gewählt");
  }

  // Replaces the phase's existing plan rather than appending — "einen Plan generieren" means a
  // fresh plan for that phase, not accumulating alongside whatever was manually curated before.
  const entries = await prisma.$transaction(async (tx) => {
    await tx.planExercise.deleteMany({ where: { userId, phase: input.phase } });
    await tx.planExercise.createMany({
      data: validItems.map((item, index) => ({
        userId,
        phase: input.phase,
        exerciseId: item.exerciseId,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        order: index,
      })),
    });
    return tx.planExercise.findMany({
      where: { userId, phase: input.phase },
      orderBy: { order: "asc" },
      include: { exercise: true },
    });
  });

  return { status: "generated", items: entries.map(toPlanExerciseDto) };
}
