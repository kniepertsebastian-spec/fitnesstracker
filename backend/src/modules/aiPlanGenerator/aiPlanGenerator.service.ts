import { Prisma, type PrismaClient, type TrainingPhase } from "@prisma/client";
import { z } from "zod";
import {
  buildSetPlan,
  coldStartInputSchema,
  DEFAULT_EQUIPMENT,
  getPhaseWeeks,
  PERIODIZATIONS,
  periodizationSchema,
  setPlanSchema,
  setSchemeSchema,
  techniqueSchema,
  type ColdStartInput,
  type Periodization,
  type PhaseStyle,
  type SetScheme,
  type Technique,
  type GeneratePlanRequest,
  type GeneratePlanResponse,
  type PlanDraftDto,
  type PlanQuestionsResponse,
  planQuestionsResponseSchema,
  type ReplaceDraftItemRequest,
  type PlanDraftItemDto,
  type PlanDraftStateDto,
  type PlanExerciseDto,
  type TrainingGoalValue,
} from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { decryptSecret } from "../../lib/crypto.js";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";
import { planExerciseInclude, toPlanExerciseDto } from "../trainingPlan/planExercise.types.js";
import { visibleToUser } from "../exercises/exercise.service.js";
import { GoogleGenAI, Type } from "@google/genai";
import { OUTGOING_TIMEOUT_MS } from "../../lib/fetchWithTimeout.js";
import { AiProviderError, callChatCompletion } from "./aiClient.js";
import {
  buildColdStartContext,
  buildPlanRemarksContext,
  buildQuestionsPrompt,
  buildSystemPrompt,
  buildWarmStartContext,
  estimateWeeklyFrequency,
  exercisesPerDayForDuration,
  loadLimitationTexts,
  phaseDefaultsFor,
  selectCatalog,
} from "./promptBuilder.js";
import { assembleDays, resolveSplit, suggestStartWeights, type RawPlanItem } from "./planAssembly.js";
import { buildAvoidMatchers } from "./avoidFilter.js";
import { applyTechniquePolicy } from "./techniquePolicy.js";
import { buildExclusions } from "./injuryFilter.js";
import { findPlateauExerciseIds } from "../goals/goalSuggestion.service.js";
import { derivePhaseItems, TRAINING_PHASES } from "./phaseRotation.js";
import { resolvePhaseConfigs } from "../trainingPlan/trainingPlan.types.js";
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
  // Intensity technique, group key and set scheme — free text here, techniquePolicy.ts decides what stays.
  technique: z.string().nullable().optional(),
  techniqueGroup: z.string().nullable().optional(),
  setScheme: z.string().nullable().optional(),
  order: z.number().min(0),
});
const aiPlanResponseSchema = z.object({
  rationale: z.string().nullable().optional(),
  periodization: z.string().nullable().optional(),
  items: z.array(aiPlanItemSchema).min(1).max(MAX_PLAN_ITEMS),
});

export const geminiWorkoutPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    rationale: { type: Type.STRING },
    periodization: { type: Type.STRING, nullable: true },
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
          technique: { type: Type.STRING, nullable: true },
          techniqueGroup: { type: Type.STRING, nullable: true },
          setScheme: { type: Type.STRING, nullable: true },
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

export async function callModel(
  prisma: PrismaClient,
  userId: string,
  systemPrompt: string,
  context: string,
  options?: { baseUrlOverride?: string; geminiResponseSchema?: object; maxOutputTokens?: number },
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
      const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: OUTGOING_TIMEOUT_MS } });
      const response = await ai.models.generateContent({
        model: setting.model || "gemini-3.5-flash-lite",
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nKontext:\n${context}` }] }],
        config: {
          temperature: 0.2,
          maxOutputTokens: options?.maxOutputTokens ?? 8192,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
          responseSchema: options?.geminiResponseSchema ?? geminiWorkoutPlanResponseSchema,
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

const geminiQuestionsResponseSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["question"],
      },
    },
  },
  required: ["questions"],
};

// 3-5 follow-up questions tailored to the questionnaire, asked before the plan is generated.
// Over-long or surplus entries from the model are trimmed rather than failing the whole request.
export async function generatePlanQuestions(
  prisma: PrismaClient,
  userId: string,
  coldStartPayload: unknown,
  options?: { baseUrlOverride?: string },
): Promise<PlanQuestionsResponse> {
  const coldStart = coldStartInputSchema.parse(coldStartPayload);
  const history = await buildWarmStartContext(prisma, userId);
  const context = [buildColdStartContext({ ...coldStart, followUps: undefined }), history]
    .filter((part) => part.trim().length > 0)
    .join("\n");
  const raw = await callModel(prisma, userId, buildQuestionsPrompt(), context, {
    ...options,
    geminiResponseSchema: geminiQuestionsResponseSchema,
    maxOutputTokens: 2048,
  });
  let json: unknown;
  try {
    json = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new AiProviderError("Antwort des KI-Anbieters war kein gültiges JSON");
  }
  const loose = z
    .object({
      questions: z.array(
        z.object({ question: z.string(), suggestions: z.array(z.string()).optional().nullable() }),
      ),
    })
    .safeParse(json);
  if (!loose.success) {
    throw new AiProviderError("Antwort des KI-Anbieters entsprach nicht dem erwarteten Format");
  }
  const questions = loose.data.questions
    .map((q) => ({
      question: q.question.trim().slice(0, 300),
      suggestions: (q.suggestions ?? [])
        .map((s) => s.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 4),
    }))
    .filter((q) => q.question.length > 0)
    .slice(0, 5);
  return planQuestionsResponseSchema.parse({ questions });
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
  periodization?: string | null;
  createdAt: Date;
}): PlanDraftDto {
  return {
    phase: snapshot.phase,
    days: snapshot.days,
    items: snapshot.items as unknown as PlanDraftItemDto[],
    rationale: snapshot.rationale,
    periodization: periodizationSchema.nullable().catch(null).parse(snapshot.periodization ?? null),
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
      includeCardio: false,
      includeStretching: false,
      techniques: [],
      schemes: ["PYRAMID", "TIME_BASED"],
      periodizations: ["LINEAR", "WAVE"],
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

  const allDays = resolveSplit(prefs.split, prefs.frequencyPerWeek, prefs.customSplit);
  const targetDays = input.day ? allDays.filter((d) => d.label === input.day) : allDays;
  if (targetDays.length === 0) {
    throw new ConflictError("Dieser Tag gehört nicht mehr zum Split — bitte den ganzen Plan neu generieren");
  }

  const limitationTexts = await loadLimitationTexts(prisma, userId, prefs);
  const exclusions = {
    ...buildExclusions(...limitationTexts),
    avoid: buildAvoidMatchers(prefs.avoidedExercises, ...limitationTexts),
  };
  // Exercises of the current plan that stopped progressing are swapped for variants.
  const planned = await prisma.planExercise.findMany({
    where: { userId },
    select: { exerciseId: true, exercise: { select: { name: true, nameDe: true } } },
  });
  const plateauIds = await findPlateauExerciseIds(prisma, userId, [...new Set(planned.map((p) => p.exerciseId))]);
  const plateauNames = [
    ...new Set(planned.filter((p) => plateauIds.has(p.exerciseId)).map((p) => p.exercise.nameDe ?? p.exercise.name)),
  ];
  const catalog = await selectCatalog(prisma, userId, prefs.equipment, allDays, exclusions, plateauIds);
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
  const plateauContext =
    plateauNames.length > 0
      ? `Diese Übungen stagnieren seit Wochen und stehen bewusst nicht im Katalog: ${plateauNames.join(", ")}. ` +
        `Wähle als Ersatz Varianten mit gleicher Hauptmuskelgruppe (anderer Winkel, anderes Gerät oder andere Griffart).`
      : "";
  const context = [historyContext, buildColdStartContext(prefs), remarksContext, plateauContext, keepContext]
    .filter((part) => part.trim().length > 0)
    .join("\n");
  const perDay = exercisesPerDayForDuration(prefs.sessionDurationMinutes);
  const phaseStyle = await loadPhaseStyle(prisma, userId, input.phase);
  const systemPrompt = buildSystemPrompt(input.phase, catalog.entries, targetDays, perDay, phaseStyle, prefs);

  const response = parseModelResponse(await callModel(prisma, userId, systemPrompt, context, options));
  const assembledRaw = assembleDays(
    response.items as RawPlanItem[],
    targetDays,
    catalog.rows,
    perDay,
    phaseDefaultsFor(input.phase, phaseStyle),
    catalog.loggedCounts,
  );
  if (assembledRaw.length === 0) {
    throw new AiProviderError("Der KI-Anbieter hat keine gültigen Übungen aus dem Katalog gewählt");
  }

  // Techniques, set schemes and the week pattern are only proposals: keep what the user allowed and
  // what makes sense (techniquePolicy.ts), in an order where grouped exercises stand together.
  const policy = applyTechniquePolicy(
    assembledRaw.map((a) => ({ day: a.day, exerciseId: a.exerciseId, technique: a.technique, techniqueGroup: a.techniqueGroup, setScheme: a.setScheme })),
    new Map(catalog.rows.map((r) => [r.id, { id: r.id, name: r.name, equipment: r.equipment, primaryMuscles: r.primaryMuscles, secondaryMuscles: r.secondaryMuscles ?? [] }])),
    {
      allowedTechniques: prefs.techniques,
      allowedSchemes: prefs.schemes,
      experience: prefs.experience,
      exercisesPerDay: perDay,
      style: phaseStyle,
    },
  );
  const rawByKey = new Map(assembledRaw.map((a) => [`${a.day}\u0000${a.exerciseId}`, a]));
  const assembled = policy.items.map((p) => ({
    ...(rawByKey.get(`${p.day}\u0000${p.exerciseId}`) as (typeof assembledRaw)[number]),
    technique: p.technique,
    techniqueGroup: p.techniqueGroup,
    setScheme: p.setScheme,
  }));

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
    technique: (a.technique as Technique | null) ?? null,
    techniqueGroup: a.techniqueGroup ?? null,
    setScheme: (a.setScheme as SetScheme | null) ?? null,
    setPlan: buildSetPlan(a.setScheme as SetScheme | null, a.targetSets, a.repRangeMin, a.repRangeMax),
    filledByServer: a.filledByServer,
  }));
  const periodization = await chooseDraftPeriodization(prisma, userId, input.phase, response.periodization, prefs, phaseStyle);

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
    periodization: input.day && existingDraft ? existingDraft.periodization : periodization,
  };
  const upsertDraft = (phase: TrainingPhase, phaseData: typeof data) =>
    prisma.planSnapshot.upsert({
      where: { userId_phase_kind: { userId, phase, kind: "DRAFT" } },
      create: { userId, phase, kind: "DRAFT", ...phaseData },
      update: { ...phaseData, createdAt: new Date() },
    });

  if (!input.allPhases || input.day) {
    return { status: "draft", draft: snapshotToDraft(await upsertDraft(input.phase, data)), replacedPlateaus: plateauNames };
  }

  // One model call, three phases: the other phases reuse the chosen exercises.
  const otherPhases = TRAINING_PHASES.filter((p) => p !== input.phase);
  const otherStyles = new Map(await Promise.all(otherPhases.map(async (p) => [p, await loadPhaseStyle(prisma, userId, p)] as const)));
  const loggedSets = recentSets.map((s) => ({ exerciseId: s.exerciseId, weightKg: Number(s.weightKg), reps: s.reps }));
  const [snapshot, ...others] = await prisma.$transaction([
    upsertDraft(input.phase, data),
    ...otherPhases.map((phase) =>
      upsertDraft(phase, {
        ...data,
        items: derivePhaseItems(newItems, input.phase, phase, loggedSets, { from: phaseStyle, to: otherStyles.get(phase) }) as unknown as Prisma.InputJsonValue,
        periodization: null,
        rationale: `Abgeleitet aus dem Entwurf für ${input.phase}: gleiche Übungen, angepasste Sätze, Wiederholungen, Pausen und Tempo.`,
      }),
    ),
  ]);
  return { status: "draft", draft: snapshotToDraft(snapshot), otherDrafts: others.map(snapshotToDraft), replacedPlateaus: plateauNames };
}

// The week-to-week pattern the model proposed for the phase, if the user allowed it, the phase is long
// enough for it to show (three weeks or more) and it is not a deload or maintenance phase.
async function chooseDraftPeriodization(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  proposed: string | null | undefined,
  prefs: ColdStartInput,
  style: PhaseStyle | null,
): Promise<Periodization | null> {
  const value = proposed?.trim().toUpperCase();
  if (!value || !(PERIODIZATIONS as readonly string[]).includes(value)) return null;
  if (!prefs.periodizations.includes(value as Periodization)) return null;
  if (style === "DELOAD" || style === "MAINTAIN") return null;
  const plan = await prisma.trainingPlan.findUnique({ where: { userId }, select: { phaseConfigs: true } });
  if (getPhaseWeeks(resolvePhaseConfigs(plan?.phaseConfigs), phase) < 3) return null;
  return value as Periodization;
}

// The style a phase was given by a phase template (deload, maintenance, ...); null for plain phases.
async function loadPhaseStyle(prisma: PrismaClient, userId: string, phase: TrainingPhase) {
  const plan = await prisma.trainingPlan.findUnique({ where: { userId }, select: { phaseConfigs: true } });
  return resolvePhaseConfigs(plan?.phaseConfigs).find((c) => c.phase === phase)?.style ?? null;
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

// Replaces one draft exercise in place: sets, reps and rest stay, exercise-specific details (cue,
// alternative, start weight) are cleared because they belonged to the old exercise.
export async function replaceDraftItem(
  prisma: PrismaClient,
  userId: string,
  input: ReplaceDraftItemRequest,
): Promise<PlanDraftDto> {
  const draft = await prisma.planSnapshot.findUnique({
    where: { userId_phase_kind: { userId, phase: input.phase, kind: "DRAFT" } },
  });
  if (!draft) throw new NotFoundError("Kein Entwurf für diese Phase vorhanden");
  const items = draft.items as unknown as PlanDraftItemDto[];
  const current = items[input.index];
  if (!current) throw new NotFoundError("Übung im Entwurf nicht gefunden");
  const exercise = await prisma.exercise.findFirst({
    where: { id: input.exerciseId, isActive: true, ...visibleToUser(userId) },
    select: { id: true, name: true, nameDe: true, equipment: true, primaryMuscles: true },
  });
  if (!exercise) throw new NotFoundError("Übung nicht gefunden");
  if (items.some((item, i) => i !== input.index && item.day === current.day && item.exerciseId === exercise.id)) {
    throw new ConflictError("Diese Übung ist an diesem Tag schon im Entwurf");
  }
  const next = [...items];
  next[input.index] = {
    ...current,
    exerciseId: exercise.id,
    exerciseName: exercise.nameDe ?? exercise.name,
    equipment: exercise.equipment,
    primaryMuscles: exercise.primaryMuscles,
    notes: null,
    startWeightKg: null,
    alternativeExerciseId: null,
    alternativeExerciseName: null,
    // The technique belonged to the old exercise; a grouped partner loses its group too.
    technique: null,
    techniqueGroup: null,
    setScheme: null,
    setPlan: null,
    filledByServer: false,
  };
  if (current.techniqueGroup) {
    for (let i = 0; i < next.length; i++) {
      if (i !== input.index && next[i].day === current.day && next[i].techniqueGroup === current.techniqueGroup) {
        next[i] = { ...next[i], technique: null, techniqueGroup: null };
      }
    }
  }
  const saved = await prisma.planSnapshot.update({
    where: { id: draft.id },
    data: { items: next as unknown as Prisma.InputJsonValue },
  });
  return snapshotToDraft(saved);
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
    technique: techniqueSchema.nullable().catch(null).parse(r.technique),
    techniqueGroup: r.techniqueGroup,
    setScheme: setSchemeSchema.nullable().catch(null).parse(r.setScheme),
    setPlan: setPlanSchema.nullable().catch(null).parse(r.setPlan),
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
      technique: i.technique ?? null,
      techniqueGroup: i.techniqueGroup ?? null,
      setScheme: i.setScheme && i.setScheme !== "STRAIGHT" ? i.setScheme : null,
      setPlan: i.setPlan ? (i.setPlan as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    }));
  await tx.planExercise.deleteMany({ where: { userId, phase } });
  await tx.planExercise.createMany({ data: rows });
  return tx.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    include: planExerciseInclude,
  });
}

// Cardio and stretching follow the accepted strength plan: their per-day versions are keyed by the
// old training days, so they are dropped and the rule-based suggestions for the new days apply.
async function planCompanions(tx: Tx, userId: string, phase: TrainingPhase) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { aiPlanPreferences: true } });
  const prefs = coldStartInputSchema.safeParse(user?.aiPlanPreferences);
  if (!prefs.success) return;
  if (prefs.data.includeCardio) {
    await tx.cardioPlanDay.deleteMany({ where: { userId, phase } });
    await tx.trainingPlan.updateMany({
      where: { userId },
      data: { trainingGoal: COLD_START_GOAL_TO_PLAN_GOAL[prefs.data.goal] },
    });
  }
  if (prefs.data.includeStretching) {
    await tx.stretchPlanItem.deleteMany({ where: { userId, phase } });
  }
}

// The week pattern the accepted draft came with becomes a property of the phase (none: the same every week).
async function setPhasePeriodization(tx: Tx, userId: string, phase: TrainingPhase, periodization: Periodization | null) {
  const plan = await tx.trainingPlan.findUnique({ where: { userId }, select: { id: true, phaseConfigs: true } });
  if (!plan) return;
  const configs = resolvePhaseConfigs(plan.phaseConfigs).map((c) => {
    if (c.phase !== phase) return c;
    const { periodization: _old, ...rest } = c;
    void _old;
    return periodization ? { ...rest, periodization } : rest;
  });
  await tx.trainingPlan.update({ where: { id: plan.id }, data: { phaseConfigs: configs as unknown as Prisma.InputJsonValue } });
}

// Removes the technique (and the set scheme) from one exercise of the draft — and from the others of its
// group, which cannot stand alone.
export async function clearDraftTechnique(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
  index: number,
): Promise<PlanDraftDto> {
  const draft = await prisma.planSnapshot.findUnique({
    where: { userId_phase_kind: { userId, phase, kind: "DRAFT" } },
  });
  if (!draft) throw new NotFoundError("Kein Entwurf für diese Phase vorhanden");
  const items = draft.items as unknown as PlanDraftItemDto[];
  const target = items[index];
  if (!target) throw new NotFoundError("Übung im Entwurf nicht gefunden");
  const next = items.map((item, i) => {
    const sameGroup = !!target.techniqueGroup && item.day === target.day && item.techniqueGroup === target.techniqueGroup;
    if (i !== index && !sameGroup) return item;
    return { ...item, technique: null, techniqueGroup: null, setScheme: null, setPlan: null };
  });
  const saved = await prisma.planSnapshot.update({
    where: { id: draft.id },
    data: { items: next as unknown as Prisma.InputJsonValue },
  });
  return snapshotToDraft(saved);
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
    await planCompanions(tx, userId, phase);
    await setPhasePeriodization(tx, userId, phase, periodizationSchema.nullable().catch(null).parse(draft.periodization));
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
