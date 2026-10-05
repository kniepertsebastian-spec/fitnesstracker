import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type {
  DailyStretchDto,
  StretchDayDto,
  StretchItemDto,
  StretchPlanDto,
  TrainingPhase,
} from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { decryptSecret } from "../../lib/crypto.js";
import { ConflictError } from "../../errors/httpErrors.js";
import { AiProviderError, callChatCompletion } from "../aiPlanGenerator/aiClient.js";
import { getCurrentTrainingPlan } from "../trainingPlan/trainingPlan.service.js";
import {
  DEFAULT_HOLD_SECONDS,
  pickDailyStretches,
  pickStretchesForMuscles,
  rankMuscles,
  type StretchCandidate,
} from "./stretchSelection.js";

// free-exercise-db tags every stretch with this category, so the catalog imported for the
// Übungen menu already contains the stretch library — no second import source needed.
const STRETCH_CATEGORY = "stretching";
const CANDIDATES_PER_PROMPT = 80;

async function loadStretchCandidates(prisma: PrismaClient): Promise<StretchCandidate[]> {
  const rows = await prisma.exercise.findMany({
    where: { isActive: true, category: { equals: STRETCH_CATEGORY, mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameDe: r.nameDe,
    description: r.description,
    imageUrls: r.imageUrls,
    primaryMuscles: r.primaryMuscles,
    secondaryMuscles: r.secondaryMuscles,
  }));
}

function toItemDto(
  c: StretchCandidate,
  holdSeconds = DEFAULT_HOLD_SECONDS,
  sets = 1,
): StretchItemDto {
  return {
    exerciseId: c.id,
    name: c.nameDe ?? c.name,
    description: c.description,
    imageUrls: c.imageUrls,
    primaryMuscles: c.primaryMuscles,
    holdSeconds,
    sets,
  };
}

interface PlanDay {
  dayLabel: string | null;
  muscles: string[];
}

// Training days of a phase with the muscles each one loads. Order follows the plan's own
// day-major `order`; a plan without split days is one unlabelled day.
async function loadPlanDays(prisma: PrismaClient, userId: string, phase: TrainingPhase): Promise<PlanDay[]> {
  const entries = await prisma.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    include: { exercise: true },
  });
  const byDay = new Map<string | null, typeof entries>();
  for (const entry of entries) {
    const bucket = byDay.get(entry.dayLabel) ?? [];
    bucket.push(entry);
    byDay.set(entry.dayLabel, bucket);
  }
  return [...byDay.entries()].map(([dayLabel, dayEntries]) => ({
    dayLabel,
    muscles: rankMuscles(dayEntries.map((e) => e.exercise)),
  }));
}

export async function getStretchPlan(
  prisma: PrismaClient,
  userId: string,
  phase?: TrainingPhase,
): Promise<StretchPlanDto> {
  const resolvedPhase = phase ?? (await getCurrentTrainingPlan(prisma, userId)).plan.currentPhase;
  const [candidates, planDays, saved] = await Promise.all([
    loadStretchCandidates(prisma),
    loadPlanDays(prisma, userId, resolvedPhase),
    prisma.stretchPlanItem.findMany({
      where: { userId, phase: resolvedPhase },
      orderBy: { order: "asc" },
      include: { exercise: true },
    }),
  ]);

  const days: StretchDayDto[] = planDays.map((day) => {
    const savedForDay = saved.filter((s) => s.dayLabel === (day.dayLabel ?? ""));
    if (savedForDay.length > 0) {
      return {
        dayLabel: day.dayLabel,
        muscles: day.muscles,
        source: "ai",
        items: savedForDay.map((s) =>
          toItemDto(
            {
              id: s.exerciseId,
              name: s.exercise.name,
              nameDe: s.exercise.nameDe,
              description: s.exercise.description,
              imageUrls: s.exercise.imageUrls,
              primaryMuscles: s.exercise.primaryMuscles,
              secondaryMuscles: s.exercise.secondaryMuscles,
            },
            s.holdSeconds,
            s.sets,
          ),
        ),
      };
    }
    const seed = `${userId}:${resolvedPhase}:${day.dayLabel ?? ""}`;
    return {
      dayLabel: day.dayLabel,
      muscles: day.muscles,
      source: "auto",
      items: pickStretchesForMuscles(candidates, day.muscles.slice(0, 4), seed).map((c) => toItemDto(c)),
    };
  });

  return { phase: resolvedPhase, days, catalogAvailable: candidates.length > 0 };
}

const aiStretchResponseSchema = z.object({
  days: z.array(
    z.object({
      day: z.string(),
      items: z
        .array(
          z.object({
            exerciseId: z.string().uuid(),
            holdSeconds: z.number().int().min(10).max(120),
            sets: z.number().int().min(1).max(3),
          }),
        )
        .max(10),
    }),
  ),
});

function buildStretchPrompt(days: PlanDay[], candidates: StretchCandidate[]): string {
  const catalog = candidates
    .map((c) => `${c.id} | ${c.nameDe ?? c.name} | ${c.primaryMuscles.join(", ")}`)
    .join("\n");
  const dayLines = days
    .map((d) => `- "${d.dayLabel ?? "Ganzkörper"}": trainierte Muskeln (stärkste zuerst): ${d.muscles.join(", ")}`)
    .join("\n");
  return [
    "Du bist ein Physiotherapeut und erstellst für jeden Trainingstag eine passende Dehnroutine zum Abschluss des Trainings.",
    "Wähle für jeden Tag 4 bis 6 Dehnübungen ausschließlich aus dem Katalog (exerciseId exakt übernehmen).",
    "Decke die an dem Tag trainierten Muskeln ab, die stärker belasteten zuerst. Haltedauer 20-60 Sekunden, 1-2 Durchgänge.",
    "Verwende als \"day\" exakt den angegebenen Tagesnamen.",
    "",
    "Trainingstage:",
    dayLines,
    "",
    "Katalog (id | Name | Hauptmuskeln):",
    catalog,
    "",
    'Antworte nur mit JSON: {"days":[{"day":"...","items":[{"exerciseId":"...","holdSeconds":30,"sets":1}]}]}',
  ].join("\n");
}

export async function generateStretchPlan(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  options?: { baseUrlOverride?: string },
): Promise<StretchPlanDto> {
  if (!env.AI_SETTINGS_ENCRYPTION_KEY) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert");
  }
  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  if (!setting) {
    throw new ConflictError("Noch kein KI-Anbieter konfiguriert — zuerst einen API-Key hinterlegen");
  }
  const apiKey = decryptSecret(setting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY);

  const [candidates, planDays] = await Promise.all([
    loadStretchCandidates(prisma),
    loadPlanDays(prisma, userId, phase),
  ]);
  if (candidates.length === 0) {
    throw new ConflictError("Keine Dehnübungen im Katalog — zuerst den Übungskatalog importieren");
  }
  if (planDays.length === 0) {
    throw new ConflictError("Für diese Phase gibt es noch keinen Trainingsplan");
  }

  // Keep the prompt small: only stretches touching a muscle the plan actually trains, plus a
  // general-purpose fallback if that filter leaves too few.
  const trained = new Set(planDays.flatMap((d) => d.muscles));
  let pool = candidates.filter((c) =>
    [...c.primaryMuscles, ...c.secondaryMuscles].some((m) => trained.has(m)),
  );
  if (pool.length < 12) pool = candidates;
  pool = pool.slice(0, CANDIDATES_PER_PROMPT);
  const poolIds = new Set(pool.map((c) => c.id));

  const raw = await callChatCompletion(
    setting.provider,
    apiKey,
    setting.model,
    [
      { role: "system", content: buildStretchPrompt(planDays, pool) },
      { role: "user", content: "Erstelle die Dehnpläne." },
    ],
    options,
  );

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiProviderError("Antwort des KI-Anbieters war kein gültiges JSON");
  }
  const parsed = aiStretchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new AiProviderError("Antwort des KI-Anbieters entsprach nicht dem erwarteten Format");
  }

  const rows: Array<{
    userId: string;
    phase: TrainingPhase;
    dayLabel: string;
    exerciseId: string;
    holdSeconds: number;
    sets: number;
    order: number;
  }> = [];
  for (const day of planDays) {
    const key = day.dayLabel ?? "Ganzkörper";
    const aiDay = parsed.data.days.find((d) => d.day === key);
    const seen = new Set<string>();
    let order = 0;
    for (const item of aiDay?.items ?? []) {
      // Hallucinated IDs and duplicates are dropped rather than trusted.
      if (!poolIds.has(item.exerciseId) || seen.has(item.exerciseId)) continue;
      seen.add(item.exerciseId);
      rows.push({
        userId,
        phase,
        dayLabel: day.dayLabel ?? "",
        exerciseId: item.exerciseId,
        holdSeconds: item.holdSeconds,
        sets: item.sets,
        order: order++,
      });
    }
  }
  if (rows.length === 0) {
    throw new AiProviderError("Der KI-Anbieter hat keine gültigen Dehnübungen aus dem Katalog gewählt");
  }

  // Days the AI skipped keep (or fall back to) the automatic mapping, so only days with valid
  // results are replaced.
  const dayLabels = [...new Set(rows.map((r) => r.dayLabel))];
  await prisma.$transaction([
    prisma.stretchPlanItem.deleteMany({ where: { userId, phase, dayLabel: { in: dayLabels } } }),
    prisma.stretchPlanItem.createMany({ data: rows }),
  ]);

  return getStretchPlan(prisma, userId, phase);
}

export async function resetStretchPlan(prisma: PrismaClient, userId: string, phase: TrainingPhase) {
  await prisma.stretchPlanItem.deleteMany({ where: { userId, phase } });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyStretch(
  prisma: PrismaClient,
  userId: string,
  focus: string | null,
): Promise<DailyStretchDto> {
  const candidates = await loadStretchCandidates(prisma);
  const picked = pickDailyStretches(candidates, focus, `${userId}:${todayKey()}`);
  return {
    focus: focus as DailyStretchDto["focus"],
    items: picked.map((c) => toItemDto(c)),
    catalogAvailable: candidates.length > 0,
  };
}
