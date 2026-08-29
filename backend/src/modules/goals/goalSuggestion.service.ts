import type { PrismaClient, WorkoutLog } from "@prisma/client";

const MIN_LOGS_REQUIRED = 3;
const MAX_SUGGESTIONS = 5;
// How far back to look for the exercise's own recent trend (progression rate, rep range,
// volume, frequency) — long enough to smooth out single-session noise, short enough that an old
// bulk/cut phase doesn't skew a suggestion made today.
const LOOKBACK_DAYS = 90;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Floors under the empirical per-week rate — a stalled or negative recent trend (a bad week, a
// deload) shouldn't be extrapolated into "you'll never progress" timelines; these are the slowest
// sane pace still worth planning a goal around.
const MIN_WEEKLY_RATE_KG = 0.1;
const MIN_WEEKLY_RATE_REPS = 0.15;
// High average reps signal an endurance/bodyweight-style exercise where "do more reps" is the
// more natural next goal than "lift more weight" — the roadmap's "Rep Range" consideration.
const REPS_GOAL_AVG_REPS_THRESHOLD = 15;

export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

// Best of the last 3 sessions never beat the best of everything before that — same rule as
// StrengthProgressCard's client-side stagnation flag (roadmap2.md/additionals consistency), kept
// as a small local reimplementation here since this runs server-side against Prisma rows instead
// of the client's cached LocalWorkoutLog[].
export function detectPlateau(series: number[]): boolean {
  if (series.length < 4) return false;
  const recentBest = Math.max(...series.slice(-3));
  const priorBest = Math.max(...series.slice(0, -3));
  return recentBest <= priorBest;
}

// A sharp volume drop (the second half of the window training at under half the first half's
// total) usually means a deload, an injury, or the user deprioritizing this exercise — not a
// moment to suggest a fresh, more ambitious goal on it. Too little data to judge either way is
// not treated as a red flag.
export function volumeHolding(logs: WorkoutLog[]): boolean {
  if (logs.length < 4) return true;
  const mid = Math.floor(logs.length / 2);
  const earlierVolume = logs.slice(0, mid).reduce((sum, l) => sum + l.reps * Number(l.weightKg), 0);
  const laterVolume = logs.slice(mid).reduce((sum, l) => sum + l.reps * Number(l.weightKg), 0);
  if (earlierVolume === 0) return true;
  return laterVolume / earlierVolume >= 0.5;
}

// Ratio of past goals hit on or before their own target date, as a global multiplier on how
// aggressive future timelines should be — a user who reliably beats their own deadlines gets
// nudged toward faster targets, one who tends to run late gets more breathing room. Needs a
// handful of data points before trusting the ratio; goals without a target date (nothing to
// compare against) don't count either way.
async function achievementAmbitionMultiplier(prisma: PrismaClient, userId: string): Promise<number> {
  const achieved = await prisma.goal.findMany({
    where: { userId, achievedAt: { not: null }, targetDate: { not: null } },
    select: { achievedAt: true, targetDate: true },
  });
  if (achieved.length < 3) return 1;
  const onTime = achieved.filter(
    (g) => g.achievedAt !== null && g.targetDate !== null && g.achievedAt <= g.targetDate,
  ).length;
  const onTimeRatio = onTime / achieved.length;
  if (onTimeRatio >= 0.7) return 1.15;
  if (onTimeRatio < 0.4) return 0.85;
  return 1;
}

export type GoalSuggestionType = "WEIGHT" | "REPS";

export interface GoalSuggestionTier {
  targetValue: number;
  targetDate: Date;
}

export interface GoalSuggestion {
  exerciseId: string;
  exerciseName: string;
  type: GoalSuggestionType;
  currentBestValue: number;
  plateauDetected: boolean;
  tiers: {
    conservative: GoalSuggestionTier;
    realistic: GoalSuggestionTier;
    ambitious: GoalSuggestionTier;
  };
}

// Suggests a next goal — WEIGHT or REPS depending on the exercise's own recent rep range — for
// exercises the user actually has a real, currently-active track record on. Three tiers
// (Konservativ/Realistisch/Ambitioniert) instead of one fixed number: each scales the same
// user- and exercise-specific weekly rate differently, so picking a tier is a real choice about
// how hard to push, not just a bigger vs. smaller number.
export async function getGoalSuggestions(
  prisma: PrismaClient,
  userId: string,
): Promise<GoalSuggestion[]> {
  const openGoals = await prisma.goal.findMany({
    where: { userId, achievedAt: null, exerciseId: { not: null }, type: { in: ["WEIGHT", "REPS"] } },
    select: { exerciseId: true },
  });
  const excludedExerciseIds = new Set(openGoals.map((g) => g.exerciseId as string));

  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS);
  const recentLogs = await prisma.workoutLog.findMany({
    where: { userId, deletedAt: null, performedAt: { gte: since } },
    orderBy: { performedAt: "asc" },
  });

  const byExercise = new Map<string, WorkoutLog[]>();
  for (const log of recentLogs) {
    if (excludedExerciseIds.has(log.exerciseId)) continue;
    const arr = byExercise.get(log.exerciseId);
    if (arr) arr.push(log);
    else byExercise.set(log.exerciseId, [log]);
  }

  const candidates = [...byExercise.entries()]
    .filter(([, logs]) => logs.length >= MIN_LOGS_REQUIRED)
    .filter(([, logs]) => volumeHolding(logs))
    .sort((a, b) => {
      const aLast = a[1][a[1].length - 1].performedAt.getTime();
      const bLast = b[1][b[1].length - 1].performedAt.getTime();
      return bLast - aLast;
    })
    .slice(0, MAX_SUGGESTIONS);

  if (candidates.length === 0) return [];

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: candidates.map(([id]) => id) } },
  });
  const exerciseNameById = new Map(exercises.map((e) => [e.id, e.nameDe ?? e.name]));

  // All-time bests, not just within the lookback window — a suggestion has to build on the
  // record the user has actually already set, or `achievementAmbitionMultiplier`'s counterpart
  // (goal.service.ts's autoAchieveIfDue, which checks the all-time best) could mark a freshly
  // adopted goal "achieved" the instant it's created, if the recent-90-day best undershoots an
  // older all-time best. The 90-day window above is still what drives rate/frequency/plateau/
  // rep-range — those genuinely should reflect recent training, just not the baseline itself.
  const allTimeBests = await prisma.workoutLog.groupBy({
    by: ["exerciseId"],
    where: { userId, deletedAt: null, exerciseId: { in: candidates.map(([id]) => id) } },
    _max: { weightKg: true, reps: true },
  });
  const allTimeBestByExercise = new Map(
    allTimeBests.map((b) => [b.exerciseId, { weightKg: Number(b._max.weightKg ?? 0), reps: b._max.reps ?? 0 }]),
  );

  const ambitionMultiplier = await achievementAmbitionMultiplier(prisma, userId);
  const now = Date.now();

  return candidates.map(([exerciseId, logs]) => {
    const avgReps = logs.reduce((sum, l) => sum + l.reps, 0) / logs.length;
    const isRepsGoal = avgReps >= REPS_GOAL_AVG_REPS_THRESHOLD;

    // Frequency floor: a rate computed from very few, widely-spaced sessions shouldn't be
    // projected onto a weekly clock — someone training an exercise once every three weeks can't
    // realistically improve on a weekly cadence just because the math says so.
    const trainedDays = new Set(logs.map((l) => l.performedAt.toISOString().slice(0, 10)));
    const daysSpan = Math.max(1, (logs[logs.length - 1].performedAt.getTime() - logs[0].performedAt.getTime()) / DAY_MS);
    const weeksSpan = Math.max(daysSpan / 7, 1 / 7);
    const sessionsPerWeek = trainedDays.size / weeksSpan;
    const minWeeksFromFrequency = sessionsPerWeek > 0 ? Math.max(1, Math.round(1 / sessionsPerWeek)) : 4;

    const earlySlice = logs.slice(0, Math.max(1, Math.ceil(logs.length / 3)));
    const exerciseName = exerciseNameById.get(exerciseId) ?? "Unbekannte Übung";
    const plateauDetected = detectPlateau(logs.map((l) => (isRepsGoal ? l.reps : Number(l.weightKg))));
    // A plateaued lift doesn't get to borrow the global ambition multiplier's boost — pushing a
    // faster timeline onto a lift that's already stuck is the opposite of realistic.
    const scale = plateauDetected ? 0.6 : 1;

    const buildTiers = (
      currentBest: number,
      empiricalRate: number,
      minWeeklyRate: number,
      increments: { conservative: number; realistic: number; ambitious: number },
      rateMultipliers: { conservative: number; realistic: number; ambitious: number },
    ): GoalSuggestion["tiers"] => {
      const effectiveRate = Math.max(
        minWeeklyRate,
        (plateauDetected ? Math.min(empiricalRate, minWeeklyRate) : empiricalRate) * ambitionMultiplier,
      );
      const tier = (increment: number, rateMultiplier: number): GoalSuggestionTier => {
        const weeksNeeded = Math.max(
          minWeeksFromFrequency,
          Math.ceil(increment / (effectiveRate * rateMultiplier)),
        );
        return { targetValue: currentBest + increment, targetDate: new Date(now + weeksNeeded * WEEK_MS) };
      };
      return {
        conservative: tier(increments.conservative, rateMultipliers.conservative),
        realistic: tier(increments.realistic, rateMultipliers.realistic),
        ambitious: tier(increments.ambitious, rateMultipliers.ambitious),
      };
    };

    const allTimeBest = allTimeBestByExercise.get(exerciseId);

    if (isRepsGoal) {
      const values = logs.map((l) => l.reps);
      const recentBest = Math.max(...values);
      // Never suggest a baseline below the all-time record — that's what determines whether a
      // freshly adopted goal is already achieved (see the comment above allTimeBestByExercise).
      const currentBest = Math.max(recentBest, allTimeBest?.reps ?? 0);
      const earliestBest = Math.max(...earlySlice.map((l) => l.reps));
      const empiricalRate = (recentBest - earliestBest) / weeksSpan;
      const conservativeInc = Math.max(1, Math.round(2 * scale));
      const realisticInc = Math.max(1, Math.round(3 * scale));
      const ambitiousInc = Math.max(2, Math.round(5 * scale));

      return {
        exerciseId,
        exerciseName,
        type: "REPS",
        currentBestValue: currentBest,
        plateauDetected,
        tiers: buildTiers(
          currentBest,
          empiricalRate,
          MIN_WEEKLY_RATE_REPS,
          { conservative: conservativeInc, realistic: realisticInc, ambitious: ambitiousInc },
          { conservative: 0.7, realistic: 1, ambitious: 1.3 },
        ),
      };
    }

    const values = logs.map((l) => Number(l.weightKg));
    const recentBest = Math.max(...values);
    const currentBest = Math.max(recentBest, allTimeBest?.weightKg ?? 0);
    const earliestBest = Math.max(...earlySlice.map((l) => Number(l.weightKg)));
    const empiricalRate = (recentBest - earliestBest) / weeksSpan;
    const conservativeInc = Math.max(0.5, roundToHalf(currentBest * 0.03 * scale));
    const realisticInc = Math.max(1, roundToHalf(currentBest * 0.05 * scale));
    const ambitiousInc = Math.max(1.5, roundToHalf(currentBest * 0.08 * scale));

    return {
      exerciseId,
      exerciseName,
      type: "WEIGHT",
      currentBestValue: currentBest,
      plateauDetected,
      tiers: buildTiers(
        currentBest,
        empiricalRate,
        MIN_WEEKLY_RATE_KG,
        { conservative: conservativeInc, realistic: realisticInc, ambitious: ambitiousInc },
        { conservative: 0.7, realistic: 1, ambitious: 1.3 },
      ),
    };
  });
}
