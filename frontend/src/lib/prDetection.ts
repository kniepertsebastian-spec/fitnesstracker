import type { LocalWorkoutLog } from "../offline/db";
import { estimateOneRepMax } from "./oneRepMax";

export interface PRResult {
  weightPR: boolean;
  repPR: boolean;
  oneRepMaxPR: boolean;
  volumePR: boolean;
}

export interface NewSet {
  reps: number;
  weightKg: number;
  performedAt: string;
}

function dayKey(performedAt: string): string {
  const d = new Date(performedAt);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export const NO_PR: PRResult = { weightPR: false, repPR: false, oneRepMaxPR: false, volumePR: false };

// Purely client-side, purely comparative against the already-cached local history — no backend
// involvement needed (see offline/workoutLogSync.ts: the full history is already local for
// offline use) and it works identically offline. Detects the moment a just-logged set(s) beats
// every prior set of the same exercise in one of four categories. `newSets` covers a whole
// plan-diary batch (several identical sets at once) as well as a single freeform log entry.
export function detectPRs(
  historyBeforeThisLog: LocalWorkoutLog[],
  exerciseId: string,
  newSets: NewSet[],
): PRResult {
  const past = historyBeforeThisLog.filter((log) => log.exerciseId === exerciseId);
  // No baseline yet — the very first time an exercise is logged isn't "beating" anything, it
  // would just be four trivially-true PRs on every debut set, which is noise, not motivation.
  if (past.length === 0 || newSets.length === 0) return NO_PR;

  const maxWeight = Math.max(...past.map((log) => log.weightKg));
  const maxReps = Math.max(...past.map((log) => log.reps));
  const maxEst1RM = Math.max(...past.map((log) => estimateOneRepMax(log.weightKg, log.reps) ?? 0));

  const newMaxWeight = Math.max(...newSets.map((s) => s.weightKg));
  const newMaxReps = Math.max(...newSets.map((s) => s.reps));
  const newMaxEst1RM = Math.max(...newSets.map((s) => estimateOneRepMax(s.weightKg, s.reps) ?? 0));

  // Volume PR compares whole-day totals, not a single set — a set-level "volume" would just
  // restate the weight/rep PRs above with extra steps, since weight×reps for one set is already
  // fully described by its own weight and reps.
  const volumeByDay = new Map<string, number>();
  for (const log of past) {
    const key = dayKey(log.performedAt);
    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + log.weightKg * log.reps);
  }
  const todayKey = dayKey(newSets[0].performedAt);
  const todayVolumeBefore = volumeByDay.get(todayKey) ?? 0;
  const newVolume = newSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
  const bestOtherDayVolume = Math.max(
    0,
    ...[...volumeByDay.entries()].filter(([key]) => key !== todayKey).map(([, v]) => v),
  );

  return {
    weightPR: newMaxWeight > maxWeight,
    repPR: newMaxReps > maxReps,
    oneRepMaxPR: newMaxEst1RM > maxEst1RM,
    // Only fires once, the moment today's running total first overtakes the best prior day —
    // not on every set of an already-record day, which would refire repeatedly for no reason.
    volumePR: todayVolumeBefore <= bestOtherDayVolume && todayVolumeBefore + newVolume > bestOtherDayVolume,
  };
}

const PR_LABELS: Record<keyof PRResult, string> = {
  weightPR: "Gewicht",
  repPR: "Wiederholungen",
  oneRepMaxPR: "Geschätztes 1RM",
  volumePR: "Tagesvolumen",
};

export function prLabels(result: PRResult): string[] {
  return (Object.keys(result) as (keyof PRResult)[]).filter((key) => result[key]).map((key) => PR_LABELS[key]);
}

export function hasAnyPR(result: PRResult): boolean {
  return result.weightPR || result.repPR || result.oneRepMaxPR || result.volumePR;
}
