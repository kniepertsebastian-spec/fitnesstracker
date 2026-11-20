import type { Exercise, PlanExercise, PrismaClient, TrainingPhase } from "@prisma/client";
import type { PhaseStyle, ProgressionSuggestion, WeeklyPlanStatusDto } from "@fitnesstracker/shared";
import { planExerciseInclude, toPlanExerciseDto } from "./planExercise.types.js";
import { addOptionsFor, loadOptionPool, swapOptionsFor } from "./exerciseOptions.js";
import { getUserTimeZone, localDayStart, localWeekStart } from "../../lib/userTime.js";
import { pickDayRotation } from "./dayRotation.js";
import { resolvePhaseConfigs } from "./trainingPlan.types.js";

const DEFAULT_TARGET_REPS: Record<TrainingPhase, number> = {
  AUFBAU: 10,
  MUSKELAUSDAUER: 20,
  NEGATIV: 5,
  DAILY: 12,
  CUSTOM_1: 10,
  CUSTOM_2: 10,
  CUSTOM_3: 10,
  CUSTOM_4: 10,
  CUSTOM_5: 10,
};

function roundToNearestHalfKg(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

interface RecentSet {
  reps: number;
  weightKg: number;
}

function computeProgression(
  phase: TrainingPhase,
  targetRepsOverride: number | null,
  recentLogs: RecentSet[],
  // Set when the phase came from a phase template: the style decides, not the slot's name.
  style?: PhaseStyle,
): ProgressionSuggestion | null {
  const [last, secondLast] = recentLogs;
  if (!last) return null;
  // A deload is about doing less, not about progressing.
  if (style === "DELOAD") return null;

  const targetReps = targetRepsOverride ?? DEFAULT_TARGET_REPS[phase] ?? 10;
  const reps = style ? style === "ENDURANCE" : phase === "MUSKELAUSDAUER";
  const mode: ProgressionSuggestion["mode"] = reps ? "reps" : "weight";
  const hitTarget = last.reps >= targetReps;
  const bothMissedSameWeight =
    !hitTarget && !!secondLast && secondLast.reps < targetReps && secondLast.weightKg === last.weightKg;

  let suggestedWeightKg = last.weightKg;
  let suggestedReps = targetReps;

  if (bothMissedSameWeight) {
    suggestedWeightKg = roundToNearestHalfKg(last.weightKg * 0.9);
  } else if (mode === "weight") {
    suggestedWeightKg = hitTarget ? last.weightKg + 2.5 : last.weightKg;
  } else {
    suggestedReps = hitTarget ? last.reps + 2 : targetReps;
  }

  return {
    mode,
    lastWeightKg: last.weightKg,
    lastReps: last.reps,
    targetReps,
    hitTarget,
    deloadSuggested: bothMissedSameWeight,
    suggestedWeightKg,
    suggestedReps,
  };
}

async function fetchRecentSetsByExercise(
  prisma: PrismaClient,
  userId: string,
  exerciseIds: string[],
): Promise<Map<string, RecentSet[]>> {
  const results = await Promise.all(
    exerciseIds.map((exerciseId) =>
      prisma.workoutLog.findMany({
        where: { userId, exerciseId, deletedAt: null },
        orderBy: [{ performedAt: "desc" }, { setNumber: "desc" }],
        take: 2,
        select: { reps: true, weightKg: true },
      }),
    ),
  );
  const byExercise = new Map<string, RecentSet[]>();
  exerciseIds.forEach((exerciseId, i) => {
    byExercise.set(
      exerciseId,
      results[i].map((r) => ({ reps: r.reps, weightKg: Number(r.weightKg) })),
    );
  });
  return byExercise;
}

type EntryWithExercise = PlanExercise & { exercise: Exercise };

function groupByDayLabel(entries: EntryWithExercise[]): { dayLabel: string | null; entries: EntryWithExercise[] }[] {
  const groups: { dayLabel: string | null; entries: EntryWithExercise[] }[] = [];
  const indexByLabel = new Map<string | null, number>();
  for (const entry of entries) {
    let idx = indexByLabel.get(entry.dayLabel);
    if (idx === undefined) {
      idx = groups.length;
      indexByLabel.set(entry.dayLabel, idx);
      groups.push({ dayLabel: entry.dayLabel, entries: [] });
    }
    groups[idx].entries.push(entry);
  }
  return groups;
}

export async function getWeeklyPlanStatus(
  prisma: PrismaClient,
  userId: string,
  phase: TrainingPhase,
): Promise<WeeklyPlanStatusDto> {
  const entries = await prisma.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    include: planExerciseInclude,
  });

  if (entries.length === 0) {
    return { days: [], activeDayIndex: null, nextDayIndex: null };
  }

  const groups = groupByDayLabel(entries);

  // For the DAILY phase, completion is checked per calendar day instead of per week.
  // Day/week borders are the user's local midnight / Monday 00:00, not UTC's.
  const now = new Date();
  const timeZone = await getUserTimeZone(prisma, userId);
  const periodStart = phase === "DAILY" ? localDayStart(now, timeZone) : localWeekStart(now, timeZone);
  const trainedInPeriod = await prisma.workoutLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: periodStart } },
    select: { exerciseId: true },
  });
  const trainedExerciseIds = new Set(trainedInPeriod.map((w) => w.exerciseId));

  const distinctExerciseIds = [...new Set(entries.map((e) => e.exerciseId))];
  const [recentSetsByExercise, pool, planRow] = await Promise.all([
    fetchRecentSetsByExercise(prisma, userId, distinctExerciseIds),
    loadOptionPool(prisma, userId),
    prisma.trainingPlan.findUnique({ where: { userId }, select: { phaseConfigs: true } }),
  ]);
  const phaseStyle = resolvePhaseConfigs(planRow?.phaseConfigs).find((c) => c.phase === phase)?.style;

  const dayIds = (group: EntryWithExercise[]) => new Set(group.map((e) => e.exerciseId));
  const toDiaryExercise = (entry: EntryWithExercise, group: EntryWithExercise[]) => ({
    ...toPlanExerciseDto(entry),
    loggedThisWeek: trainedExerciseIds.has(entry.exerciseId),
    progression: computeProgression(
      phase,
      entry.targetReps,
      recentSetsByExercise.get(entry.exerciseId) ?? [],
      phaseStyle,
    ),
    swapOptions: swapOptionsFor(pool, entry.exercise.primaryMuscles[0], dayIds(group), entry.alternativeExerciseId),
  });
  const addOptions = (group: EntryWithExercise[]) =>
    addOptionsFor(pool, [...new Set(group.flatMap((e) => e.exercise.primaryMuscles.slice(0, 1)))], dayIds(group));

  if (groups.length <= 1) {
    return {
      days: groups.map((g) => ({
        dayLabel: g.dayLabel,
        exercises: g.entries.map((e) => toDiaryExercise(e, g.entries)),
        completed: false,
        addOptions: addOptions(g.entries),
      })),
      activeDayIndex: 0,
      nextDayIndex: 0,
    };
  }

  const days = groups.map((g) => ({
    dayLabel: g.dayLabel,
    exercises: g.entries.map((e) => toDiaryExercise(e, g.entries)),
    completed: g.entries.every((e) => trainedExerciseIds.has(e.exerciseId)),
    addOptions: addOptions(g.entries),
  }));

  // Which day is due follows the cycle (the day after the last trained one), see dayRotation.ts.
  const recentLogs = await prisma.workoutLog.findMany({
    where: { userId, deletedAt: null, exerciseId: { in: distinctExerciseIds } },
    orderBy: { performedAt: "desc" },
    take: 60,
    select: { exerciseId: true, performedAt: true },
  });
  const rotation = pickDayRotation(
    days.map((d, i) => ({
      dayLabel: d.dayLabel,
      exerciseIds: groups[i].entries.map((e) => e.exerciseId),
      completed: d.completed,
    })),
    recentLogs,
  );
  return { days, activeDayIndex: rotation.activeDayIndex, nextDayIndex: rotation.nextDayIndex };
}
