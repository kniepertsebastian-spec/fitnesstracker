import type { PrismaClient } from "@prisma/client";

const MIN_LOGS_REQUIRED = 3;
const MAX_SUGGESTIONS = 5;

// Deliberately NOT a linear extrapolation of the user's own historical rate — early "newbie
// gains" are often much faster than what's sustainable long-term, and extrapolating that
// straight line would suggest an unrealistically close deadline. 0.25kg/week (~1kg/month) is a
// conservative, broadly literature-typical long-term strength progression rate that works as a
// sane default across very different lifts, from isolation exercises to big compounds.
const PROGRESSION_KG_PER_WEEK = 0.25;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export interface GoalSuggestion {
  exerciseId: string;
  exerciseName: string;
  currentBestKg: number;
  suggestedTargetKg: number;
  suggestedTargetDate: Date;
}

// Suggests a next WEIGHT goal for exercises the user actually has a real track record on —
// at least a handful of logged sets, so a single fluke heavy set doesn't drive the suggestion —
// and skips any exercise that already has an open WEIGHT goal, to avoid nagging with duplicates.
export async function getGoalSuggestions(
  prisma: PrismaClient,
  userId: string,
): Promise<GoalSuggestion[]> {
  const openWeightGoals = await prisma.goal.findMany({
    where: { userId, type: "WEIGHT", achievedAt: null, exerciseId: { not: null } },
    select: { exerciseId: true },
  });
  const excludedExerciseIds = new Set(openWeightGoals.map((g) => g.exerciseId as string));

  const grouped = await prisma.workoutLog.groupBy({
    by: ["exerciseId"],
    where: { userId, deletedAt: null },
    _max: { weightKg: true, performedAt: true },
    _count: { _all: true },
  });

  const candidates = grouped
    .filter((g) => g._count._all >= MIN_LOGS_REQUIRED)
    .filter((g) => !excludedExerciseIds.has(g.exerciseId))
    .filter((g) => g._max.weightKg !== null && Number(g._max.weightKg) > 0)
    .sort((a, b) => (b._max.performedAt?.getTime() ?? 0) - (a._max.performedAt?.getTime() ?? 0))
    .slice(0, MAX_SUGGESTIONS);

  if (candidates.length === 0) return [];

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: candidates.map((c) => c.exerciseId) } },
  });
  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.name]));

  const now = Date.now();
  return candidates.map((c) => {
    const currentBestKg = Number(c._max.weightKg);
    // Modest overload: +5%, floored at +1kg so light/isolation lifts still get a meaningful
    // target instead of a suggestion indistinguishable from the current best.
    const incrementKg = Math.max(1, roundToHalf(currentBestKg * 0.05));
    const suggestedTargetKg = currentBestKg + incrementKg;
    const weeksNeeded = Math.ceil(incrementKg / PROGRESSION_KG_PER_WEEK);

    return {
      exerciseId: c.exerciseId,
      exerciseName: exerciseNameById.get(c.exerciseId) ?? "Unbekannte Übung",
      currentBestKg,
      suggestedTargetKg,
      suggestedTargetDate: new Date(now + weeksNeeded * WEEK_MS),
    };
  });
}
