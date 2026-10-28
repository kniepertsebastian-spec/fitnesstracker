import type { Exercise, PlanExercise, PrismaClient, TrainingPhase } from "@prisma/client";
import type { ProgressionSuggestion, WeeklyPlanStatusDto } from "@fitnesstracker/shared";
import { planExerciseInclude, toPlanExerciseDto } from "./planExercise.types.js";
import { addOptionsFor, loadOptionPool, swapOptionsFor } from "./exerciseOptions.js";

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
): ProgressionSuggestion | null {
  const [last, secondLast] = recentLogs;
  if (!last) return null;

  const targetReps = targetRepsOverride ?? DEFAULT_TARGET_REPS[phase] ?? 10;
  const mode: ProgressionSuggestion["mode"] = phase === "MUSKELAUSDAUER" ? "reps" : "weight";
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

function currentWeekMondayUtc(): Date {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = day.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  day.setUTCDate(day.getUTCDate() - daysSinceMonday);
  return day;
}

function todayStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
    return { days: [], activeDayIndex: null };
  }

  const groups = groupByDayLabel(entries);

  // For the DAILY phase, completion is checked per calendar day instead of per week.
  const periodStart = phase === "DAILY" ? todayStartUtc() : currentWeekMondayUtc();
  const trainedInPeriod = await prisma.workoutLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: periodStart } },
    select: { exerciseId: true },
  });
  const trainedExerciseIds = new Set(trainedInPeriod.map((w) => w.exerciseId));

  const distinctExerciseIds = [...new Set(entries.map((e) => e.exerciseId))];
  const [recentSetsByExercise, pool] = await Promise.all([
    fetchRecentSetsByExercise(prisma, userId, distinctExerciseIds),
    loadOptionPool(prisma, userId),
  ]);

  const dayIds = (group: EntryWithExercise[]) => new Set(group.map((e) => e.exerciseId));
  const toDiaryExercise = (entry: EntryWithExercise, group: EntryWithExercise[]) => ({
    ...toPlanExerciseDto(entry),
    loggedThisWeek: trainedExerciseIds.has(entry.exerciseId),
    progression: computeProgression(
      phase,
      entry.targetReps,
      recentSetsByExercise.get(entry.exerciseId) ?? [],
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
    };
  }

  const days = groups.map((g) => ({
    dayLabel: g.dayLabel,
    exercises: g.entries.map((e) => toDiaryExercise(e, g.entries)),
    completed: g.entries.every((e) => trainedExerciseIds.has(e.exerciseId)),
    addOptions: addOptions(g.entries),
  }));

  const firstIncomplete = days.findIndex((d) => !d.completed);
  return { days, activeDayIndex: firstIncomplete === -1 ? null : firstIncomplete };
}
