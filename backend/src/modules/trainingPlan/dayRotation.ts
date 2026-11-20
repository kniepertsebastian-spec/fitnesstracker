// Which split day is "today's workout". Pure (no DB), so it is unit-testable.
//
// The old rule — "first day not completely trained this week" — got stuck on day 1 as soon as one of
// its exercises was skipped or swapped, and fell back to day 1 once everything was done. The rule
// now follows the cycle: the day after the one trained last, skipping days already finished this week.

export interface RotationDay {
  dayLabel: string | null;
  exerciseIds: string[];
  // Every exercise of the day was logged this week.
  completed: boolean;
}

export interface RotationLog {
  exerciseId: string;
  performedAt: Date;
}

// Sets logged within this window of the newest set count as the same workout.
const SAME_WORKOUT_MS = 4 * 60 * 60 * 1000;

export interface DayRotation {
  // First day after the last trained one that is not finished this week; null when all are finished.
  activeDayIndex: number | null;
  // The day after the last trained one, finished or not — the default when everything is done.
  nextDayIndex: number;
}

export function pickDayRotation(days: RotationDay[], recentLogs: RotationLog[]): DayRotation {
  // An unlabelled group next to named days is a leftover (e.g. an import that lost the day labels), not
  // a workout of its own: it must never be the suggestion.
  const hasNamed = days.some((d) => d.dayLabel !== null);
  const candidates = days.map((_, i) => i).filter((i) => !hasNamed || days[i].dayLabel !== null);
  if (candidates.length === 0) return { activeDayIndex: null, nextDayIndex: 0 };

  const lastPosition = lastTrainedPosition(days, candidates, recentLogs);
  const ring = candidates.map((_, k) => candidates[(lastPosition + 1 + k) % candidates.length]);
  const active = ring.find((i) => !days[i].completed);
  return { activeDayIndex: active ?? null, nextDayIndex: ring[0] };
}

// Position within `candidates` of the day trained in the latest workout, -1 when none was.
function lastTrainedPosition(days: RotationDay[], candidates: number[], recentLogs: RotationLog[]): number {
  if (recentLogs.length === 0) return -1;
  const sorted = [...recentLogs].sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
  const latest = sorted[0];
  const workout = sorted.filter((l) => latest.performedAt.getTime() - l.performedAt.getTime() <= SAME_WORKOUT_MS);
  const trained = new Set(workout.map((l) => l.exerciseId));

  let best = -1;
  let bestScore = 0;
  let bestHasLatest = false;
  candidates.forEach((dayIndex, position) => {
    const ids = new Set(days[dayIndex].exerciseIds);
    const score = [...trained].filter((id) => ids.has(id)).length;
    if (score === 0) return;
    const hasLatest = ids.has(latest.exerciseId);
    if (score > bestScore || (score === bestScore && hasLatest && !bestHasLatest)) {
      best = position;
      bestScore = score;
      bestHasLatest = hasLatest;
    }
  });
  return best;
}
