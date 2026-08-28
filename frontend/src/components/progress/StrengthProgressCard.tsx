import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { estimateOneRepMax } from "../../lib/oneRepMax";
import { rangeCutoff, type ProgressRange } from "../../lib/progressRange";

const MAX_VISIBLE = 6;

interface ExerciseBest {
  exerciseId: string;
  exerciseName: string;
  bestWeightKg: number;
  bestReps: number;
  oneRepMax: number | null;
  lastPerformedAt: string;
}

// Per-exercise "best set" within the selected range — the set with the highest estimated 1RM,
// not just the heaviest weight alone (5kg×20 can beat 5kg×1 for actual strength, even though the
// weight number looks smaller). Sorted by most-recently-trained rather than heaviest-overall:
// this is meant to read as "what have you been working on lately", not an all-time leaderboard.
export function StrengthProgressCard({ range }: { range: ProgressRange }) {
  const { data: logs, isLoading } = useWorkoutLogs();

  if (isLoading) return null;

  const cutoff = rangeCutoff(range);
  const inRange = (logs ?? []).filter((log) => !cutoff || new Date(log.performedAt) >= cutoff);

  const byExercise = new Map<string, ExerciseBest>();
  for (const log of inRange) {
    const oneRepMax = estimateOneRepMax(log.weightKg, log.reps);
    const existing = byExercise.get(log.exerciseId);
    if (!existing) {
      byExercise.set(log.exerciseId, {
        exerciseId: log.exerciseId,
        exerciseName: log.exerciseName,
        bestWeightKg: log.weightKg,
        bestReps: log.reps,
        oneRepMax,
        lastPerformedAt: log.performedAt,
      });
      continue;
    }
    if (log.performedAt > existing.lastPerformedAt) existing.lastPerformedAt = log.performedAt;
    if (oneRepMax !== null && (existing.oneRepMax === null || oneRepMax > existing.oneRepMax)) {
      existing.oneRepMax = oneRepMax;
      existing.bestWeightKg = log.weightKg;
      existing.bestReps = log.reps;
    }
  }

  const visible = [...byExercise.values()]
    .sort((a, b) => (a.lastPerformedAt < b.lastPerformedAt ? 1 : -1))
    .slice(0, MAX_VISIBLE);

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="mb-2 text-sm font-medium text-ink-300">Kraft &amp; PRs</p>
      {visible.length === 0 ? (
        <p className="text-sm text-ink-500">Keine Sätze in diesem Zeitraum.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((ex) => (
            <div key={ex.exerciseId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-ink-100">{ex.exerciseName}</span>
              <span className="shrink-0 text-ink-500">
                {ex.bestWeightKg}kg × {ex.bestReps}
                {ex.oneRepMax !== null && (
                  <span className="text-violet-400"> · ≈1RM {Math.round(ex.oneRepMax)}kg</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
