import type { Prisma, PrismaClient, TrainingPhase } from "@prisma/client";
import { z } from "zod";
import {
  coldStartInputSchema,
  DEFAULT_EQUIPMENT,
  type ColdStartInput,
  type GeneratePlanRequest,
  type GeneratePlanResponse,
  type PlanDraftDto,
  type PlanDraftItemDto,
  type PlanDraftStateDto,
  type PlanExerciseDto,
  type TrainingGoalValue,
} from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { decryptSecret } from "../../lib/crypto.js";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import { planExerciseInclude, toPlanExerciseDto } from "../trainingPlan/planExercise.types.js";
import { GoogleGenAI, Type } from "@google/genai";
import { AiProviderError, callChatCompletion } from "./aiClient.js";
import {
  buildColdStartContext,
  buildPlanRemarksContext,
  buildSystemPrompt,
  buildWarmStartContext,
  estimateWeeklyFrequency,
  exercisesPerDayForDuration,
  loadLimitationTexts,
  PHASE_DEFAULTS,
  selectCatalog,
} from "./promptBuilder.js";
import { assembleDays, resolveSplit, suggestStartWeights, type RawPlanItem } from "./planAssembly.js";
import { buildExclusions } from "./injuryFilter.js";
import { refreshDetectedAsymmetries } from "../trainingPlan/trainingAsymmetry.service.js";

const MIN_LOGGED_SETS_FOR_WARM_START = 5;
const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;

const COLD_START_GOAL_TO_PLAN_GOAL: Record<ColdStartInput["goal"], TrainingGoalValue> = {
  muscle_gain: "MUSCLE_GAIN",
  strength: "STRENGTH",
  endurance: "ENDURANCE",
  fat_loss: "FAT_LOSS",
  general_fitness: "GENERAL_FITNESS",
};
const MAX_PLAN_ITEMS = 60;

// Lenient on the coaching fields (models leave them out or send null) — assembleDays fills in
// phase defaults; strict on what identifies an item.
const optionalInt = z.number().nullable().optional();
const aiPlanItemSchema = z.object({
  day: z.string(),
  exerciseId: z.string(),
  targetSets: z.number().positive().max(20),
  targetReps: optionalInt,
  repRangeMin: optionalInt,
  repRangeMax: optionalInt,
  targetRir: optionalInt,
  restSeconds: optionalInt,
  cue: z.string().nullable().optional(),
  alternativeExerciseId: z.string().nullable().optional(),
  order: z.number().min(0),
});
const aiPlanResponseSchema = z.object({
  rationale: z.string().nullable().optional(),
  items: z.array(aiPlanItemSchema).min(1).max(MAX_PLAN_ITEMS),
});

export const geminiWorkoutPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    rationale: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          exerciseId: { type: Type.STRING },
          targetSets: { type: Type.INTEGER },
          repRangeMin: { type: Type.INTEGER },
          repRangeMax: { type: Type.INTEGER },
          targetRir: { type: Type.INTEGER },
          restSeconds: { type: Type.INTEGER },
          cue: { type: Type.STRING },
          alternativeExerciseId: { type: Type.STRING, nullable: true },
          order: { type: Type.INTEGER },
        },
        required: ["day", "exerciseId", "targetSets", "repRangeMin", "repRangeMax", "targetRir", "restSeconds", "cue", "order"],
      },
    },
  },
  required: ["rationale", "items"],
};

async function hasEnoughHistory(prisma: PrismaClient, userId: string): Promise<boolean> {
  const count = await prisma.workoutLog.count({ where: { userId, deletedAt: null } });
  return count >= MIN_LOGGED_SETS_FOR_WARM_START;
}

export async function getPlanPreferences(prisma: PrismaClient, userId: string): Promise<ColdStartInput | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiPlanPreferences: true } });
  const parsed = coldStartInputSchema.safeParse(user?.aiPlanPreferences);
  // Older/garbled answers are simply not prefilled.
  return parsed.success ? parsed.data : null;
}

async function callModel(
  prisma: PrismaClient,
  userId: string,
  systemPrompt: string,
  context: string,
  options?: { baseUrlOverride?: string },
): Promise<string> {
  if (!env.AI_SETTINGS_ENCRYPTION_KEY) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert");
  }
  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  if (!setting) {
    throw new ConflictError("Noch kein KI-Anbieter konfiguriert — zuerst einen API-Key hinterlegen");
  }
  const apiKey = decryptSecret(setting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY);

  if (setting.provider === "GEMINI" && !options?.baseUrlOverride) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: setting.model || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nKontext:\n${context}` }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: geminiWorkoutPlanResponseSchema,
        },
      });
      return response.text ?? "";
    } catch (error) {
      throw new AiProviderError(
        `Could not reach the AI provider: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return callChatCompletion(
    setting.provider,
    apiKey,
    setting.model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: context },
    ],
    options,
  );
}

function parseModelResponse(rawContent: string) {
  let parsedJson: unknown;
  try {
    // Some chat models wrap JSON in a ```json fence despite being told not to.
    parsedJson = JSON.parse(rawContent.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new AiProviderError("Antwort des KI-Anbieters war kein gültiges JSON");
  }
  const parsed = aiPlanResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new AiProviderError("Antwort des KI-Anbieters entsprach nicht dem erwarteten Format");
  }
  return parsed.data;
}

function snapshotToDraft(snapshot: {
  phase: TrainingPhase;
  days: string[];
  items: Prisma.JsonValue;
  rationale: string | null;
  createdAt: Date;
}): PlanDraftDto {
  return {
    phase: snapshot.phase,
    days: snapshot.days,
    items: snapshot.items as unknown as PlanDraftItemDto[],
    rationale: snapshot.rationale,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

// Builds a draft plan for a phase — never touches the live plan; acceptPlanDraft does that.
// With `day`, only that day of the existing draft is regenerated and the rest is kept.
export async function generatePlan(
  prisma: PrismaClient,
  userId: string,
  input: GeneratePlanRequest,
  options?: { baseUrlOverride?: string },
): Promise<GeneratePlanResponse> {
  const enoughHistory = await hasEnoughHistory(prisma, userId);
  const saved = await getPlanPreferences(prisma, userId);
  const coldStart = input.coldStart ? coldStartInputSchema.parse(input.coldStart) : null;
  if (!enoughHistory && !coldStart && !saved) {
    return { status: "needs_cold_start" };
  }
  // No questionnaire sent: reuse the last answers, else derive what history allows.
  const prefs: ColdStartInput = coldStart ??
    saved ?? {
      frequencyPerWeek: await estimateWeeklyFrequency(prisma, userId),
      split: "auto",
      equipment: DEFAULT_EQUIPMENT,
      experience: "intermediate",
      goal: "muscle_gain",
      sessionDurationMinutes: 60,
    };

  const existingDraft = input.day
    ? await prisma.planSnapshot.findUnique({
        where: { userId_phase_kind: { userId, phase: input.phase, kind: "DRAFT" } },
      })
    : null;
  if (input.day && !existingDraft) throw new NotFoundError("Kein Entwurf für diese Phase vorhanden");

  if (coldStart) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiPlanPreferences: coldStart as unknown as Prisma.InputJsonValue },
    });
    await prisma.trainingPlan.updateMany({
      where: { userId, trainingGoal: null },
      data: { trainingGoal: COLD_START_GOAL_TO_PLAN_GOAL[coldStart.goal] },
    });
  }

  const allDays = resolveSplit(prefs.split, prefs.frequencyPerWeek);
  const targetDays = input.day ? allDays.filter((d) => d.label === input.day) : allDays;
  if (targetDays.length === 0) {
    throw new ConflictError("Dieser Tag gehört nicht mehr zum Split — bitte den ganzen Plan neu generieren");
  }

  const exclusions = buildExclusions(...(await loadLimitationTexts(prisma, userId, prefs)));
  const catalog = await selectCatalog(prisma, userId, prefs.equipment, allDays, exclusions);
  if (catalog.entries.length === 0) {
    throw new ConflictError("Keine passenden Übungen für diese Vorgaben gefunden");
  }

  await refreshDetectedAsymmetries(prisma, userId);
  const remarksContext = await buildPlanRemarksContext(prisma, userId);
  const historyContext = enoughHistory ? await buildWarmStartContext(prisma, userId) : "";
  const keepContext =
    input.day && existingDraft
      ? `Erstelle NUR den Tag "${input.day}" neu; die anderen Tage bleiben unverändert. Wähle möglichst andere Übungen als bisher an diesem Tag.`
      : "";
  const context = [historyContext, buildColdStartContext(prefs), remarksContext, keepContext]
    .filter((part) => part.trim().length > 0)
    .join("\n");
  const perDay = exercisesPerDayForDuration(prefs.sessionDurationMinutes);
  const systemPrompt = buildSystemPrompt(input.phase, catalog.entries, targetDays, perDay);

  const response = parseModelResponse(await callModel(prisma, userId, systemPrompt, context, options));
  const assembled = assembleDays(
    response.items as RawPlanItem[],
    targetDays,
    catalog.rows,
    perDay,
    PHASE_DEFAULTS[input.phase],
    catalog.loggedCounts,
  );
  if (assembled.length === 0) {
    throw new AiProviderError("Der KI-Anbieter hat keine gültigen Übungen aus dem Katalog gewählt");
  }

  const recentSets = await prisma.workoutLog.findMany({
    where: {
      userId,
      deletedAt: null,
      exerciseId: { in: assembled.map((a) => a.exerciseId) },
      performedAt: { gte: new Date(Date.now() - EIGHT_WEEKS_MS) },
    },
    select: { exerciseId: true, weightKg: true, reps: true },
  });
  const startWeights = suggestStartWeights(
    recentSets.map((s) => ({ exerciseId: s.exerciseId, weightKg: Number(s.weightKg), reps: s.reps })),
    assembled.map((a) => ({ exerciseId: a.exerciseId, reps: a.repRangeMax, rir: a.targetRir })),
  );

  const rowById = new Map(catalog.rows.map((r) => [r.id, r]));
  const nameOf = (id: string) => {
    const row = rowById.get(id);
    return row ? (row.nameDe ?? row.name) : "?";
  };
  const singleDay = allDays.length === 1;
  const newItems: PlanDraftItemDto[] = assembled.map((a) => ({
    day: singleDay ? null : a.day,
    exerciseId: a.exerciseId,
    exerciseName: nameOf(a.exerciseId),
    equipment: rowById.get(a.exerciseId)?.equipment ?? null,
    primaryMuscles: rowById.get(a.exerciseId)?.primaryMuscles ?? [],
    targetSets: a.targetSets,
    targetReps: a.repRangeMax,
    repRangeMin: a.repRangeMin,
    repRangeMax: a.repRangeMax,
    targetRir: a.targetRir,
    restSeconds: a.restSeconds,
    notes: a.notes,
    startWeightKg: startWeights.get(a.exerciseId) ?? null,
    alternativeExerciseId: a.alternativeExerciseId,
    alternativeExerciseName: a.alternativeExerciseId ? nameOf(a.alternativeExerciseId) : null,
    filledByServer: a.filledByServer,
  }));

  let items = newItems;
  let rationale = response.rationale?.trim() || null;
  if (input.day && existingDraft) {
    // Keep the other days in their original order, swap in the regenerated one.
    const previous = existingDraft.items as unknown as PlanDraftItemDto[];
    const dayKey = singleDay ? null : input.day;
    items = allDays.flatMap((d) => {
      const key = singleDay ? null : d.label;
      return key === dayKey ? newItems : previous.filter((p) => p.day === key);
    });
    rationale = existingDraft.rationale;
  }

  const data = {
    days: allDays.map((d) => d.label),
    items: items as unknown as Prisma.InputJsonValue,
    rationale,
  };
  const snapshot = await prisma.planSnapshot.upsert({
    where: { userId_phase_kind: { userId, phase: input.phase, kind: "DRAFT" } },
    create: { userId, phase: input.phase, kind: "DRAFT", ...data },
    update: { ...data, createdAt: new Date() },
  });
  return { status: "draft", draft: snapshotToDraft(snapshot) };
}

export async function getPlanDraftState(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
): Promise<PlanDraftStateDto> {
  const snapshots = await prisma.planSnapshot.findMany({ where: { userId, phase } });
  const draft = snapshots.find((s) => s.kind === "DRAFT");
  return {
    draft: draft ? snapshotToDraft(draft) : null,
    hasBackup: snapshots.some((s) => s.kind === "BACKUP"),
  };
}

export async function discardPlanDraft(prisma: PrismaClient, userId: string, phase: TrainingPhase) {
  await prisma.planSnapshot.deleteMany({ where: { userId, phase, kind: "DRAFT" } });
}

type Tx = Prisma.TransactionClient;

async function currentPlanAsItems(tx: Tx, userId: string, phase: TrainingPhase): Promise<PlanDraftItemDto[]> {
  const rows = await tx.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    include: planExerciseInclude,
  });
  return rows.map((r) => ({
    day: r.dayLabel,
    exerciseId: r.exerciseId,
    exerciseName: r.exercise.nameDe ?? r.exercise.name,
    equipment: r.exercise.equipment,
    primaryMuscles: r.exercise.primaryMuscles,
    targetSets: r.targetSets,
    targetReps: r.targetReps,
    repRangeMin: r.repRangeMin,
    repRangeMax: r.repRangeMax,
    targetRir: r.targetRir,
    restSeconds: r.restSeconds,
    notes: r.notes,
    startWeightKg: r.startWeightKg === null ? null : Number(r.startWeightKg),
    alternativeExerciseId: r.alternativeExerciseId,
    alternativeExerciseName: r.alternativeExercise ? (r.alternativeExercise.nameDe ?? r.alternativeExercise.name) : null,
    filledByServer: false,
  }));
}

// Replaces the phase's plan with `items` (in the given order) after saving the current plan as
// the restorable backup.
async function replacePlan(tx: Tx, userId: string, phase: TrainingPhase, items: PlanDraftItemDto[]) {
  const current = await currentPlanAsItems(tx, userId, phase);
  const days = [...new Set(current.map((c) => c.day).filter((d): d is string => d !== null))];
  await tx.planSnapshot.upsert({
    where: { userId_phase_kind: { userId, phase, kind: "BACKUP" } },
    create: { userId, phase, kind: "BACKUP", days, items: current as unknown as Prisma.InputJsonValue },
    update: { days, items: current as unknown as Prisma.InputJsonValue, rationale: null, createdAt: new Date() },
  });

  // A restored backup may reference an exercise deleted since; skip those instead of failing.
  const ids = [...new Set(items.flatMap((i) => [i.exerciseId, i.alternativeExerciseId]).filter((x): x is string => !!x))];
  const existing = new Set((await tx.exercise.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((e) => e.id));
  const seen = new Set<string>();
  const rows = items
    .filter((i) => existing.has(i.exerciseId))
    .filter((i) => {
      const key = `${i.day ?? ""}:${i.exerciseId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((i, order) => ({
      userId,
      phase,
      exerciseId: i.exerciseId,
      targetSets: i.targetSets,
      targetReps: i.targetReps,
      order,
      dayLabel: i.day,
      repRangeMin: i.repRangeMin,
      repRangeMax: i.repRangeMax,
      targetRir: i.targetRir,
      restSeconds: i.restSeconds,
      notes: i.notes,
      startWeightKg: i.startWeightKg,
      alternativeExerciseId: i.alternativeExerciseId && existing.has(i.alternativeExerciseId) ? i.alternativeExerciseId : null,
    }));
  await tx.planExercise.deleteMany({ where: { userId, phase } });
  await tx.planExercise.createMany({ data: rows });
  return tx.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    include: planExerciseInclude,
  });
}

export async function acceptPlanDraft(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
): Promise<PlanExerciseDto[]> {
  const entries = await prisma.$transaction(async (tx) => {
    const draft = await tx.planSnapshot.findUnique({
      where: { userId_phase_kind: { userId, phase, kind: "DRAFT" } },
    });
    if (!draft) throw new NotFoundError("Kein Entwurf für diese Phase vorhanden");
    const result = await replacePlan(tx, userId, phase, draft.items as unknown as PlanDraftItemDto[]);
    await tx.planSnapshot.delete({ where: { id: draft.id } });
    return result;
  });
  return entries.map(toPlanExerciseDto);
}

// Swaps the plan and its backup, so restoring twice gets back to where you were.
export async function restorePlanBackup(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
): Promise<PlanExerciseDto[]> {
  const entries = await prisma.$transaction(async (tx) => {
    const backup = await tx.planSnapshot.findUnique({
      where: { userId_phase_kind: { userId, phase, kind: "BACKUP" } },
    });
    if (!backup) throw new NotFoundError("Kein vorheriger Plan gespeichert");
    return replacePlan(tx, userId, phase, backup.items as unknown as PlanDraftItemDto[]);
  });
  return entries.map(toPlanExerciseDto);
}
