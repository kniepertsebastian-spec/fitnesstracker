import { useState } from "react";
import type { LocalWorkoutLog } from "../../offline/db";
import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { estimateOneRepMax } from "../../lib/oneRepMax";
import { rangeCutoff, type ProgressRange } from "../../lib/progressRange";
import { Sparkline } from "./Sparkline";

const MAX_VISIBLE = 6;

interface ExerciseBest {
  exerciseId: string;
  exerciseName: string;
  bestWeightKg: number;
  bestReps: number;
  oneRepMax: number | null;
  lastPerformedAt: string;
}

// One 1RM value per day this exercise was trained (the day's best set), oldest first — feeds
// the per-exercise Sparkline and the stagnation check below.
function sessionOneRepMaxSeries(logs: LocalWorkoutLog[], exerciseId: string): number[] {
  const byDay = new Map<string, number>();
  for (const log of logs) {
    if (log.exerciseId !== exerciseId) continue;
    const oneRepMax = estimateOneRepMax(log.weightKg, log.reps);
    if (oneRepMax === null) continue;
    const day = log.performedAt.slice(0, 10);
    const existing = byDay.get(day);
    if (existing === undefined || oneRepMax > existing) byDay.set(day, oneRepMax);
  }
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
}

// "Stagnating" means the best of the last 3 sessions never exceeded the best of everything
// before that — a simple, explainable plateau check rather than a trend-line regression, which
// would overclaim precision this app's data doesn't really support (a handful of session points).
function isStagnating(series: number[]): boolean {
  if (series.length < 4) return false;
  const recentBest = Math.max(...series.slice(-3));
  const priorBest = Math.max(...series.slice(0, -3));
  return recentBest <= priorBest;
}

// Per-exercise "best set" within the selected range — the set with the highest estimated 1RM,
// not just the heaviest weight alone (5kg×20 can beat 5kg×1 for actual strength, even though the
// weight number looks smaller). Sorted by most-recently-trained rather than heaviest-overall:
// this is meant to read as "what have you been working on lately", not an all-time leaderboard.
// Tapping a row expands a small 1RM-over-time chart for that exercise plus a stagnation flag —
// the roadmap's "Exercise Progress Charts" / "Stagnation erkennen" asks.
export function StrengthProgressCard({ range }: { range: ProgressRange }) {
  const { data: logs, isLoading } = useWorkoutLogs();
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        <div className="flex flex-col gap-1">
          {visible.map((ex) => {
            const series = sessionOneRepMaxSeries(logs ?? [], ex.exerciseId);
            const stagnating = isStagnating(series);
            const expanded = expandedId === ex.exerciseId;
            return (
              <div key={ex.exerciseId}>
                <button
                  onClick={() => setExpandedId(expanded ? null : ex.exerciseId)}
                  className="flex w-full items-center justify-between gap-2 py-1 text-left text-sm"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-ink-100">{ex.exerciseName}</span>
                    {stagnating && (
                      <span
                        className="shrink-0 text-amber-400"
                        title="Stagniert — kein neuer Bestwert in den letzten 3 Trainingseinheiten dieser Übung"
                      >
                        ⏸
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-ink-500">
                    {ex.bestWeightKg}kg × {ex.bestReps}
                    {ex.oneRepMax !== null && (
                      <span className="text-violet-400"> · ≈1RM {Math.round(ex.oneRepMax)}kg</span>
                    )}
                  </span>
                </button>
                {expanded && (
                  <div className="mb-2 rounded-lg border border-ink-800 bg-ink-950 p-2">
                    {series.length >= 2 ? (
                      <>
                        <Sparkline values={series} />
                        <p className="mt-1 text-xs text-ink-600">
                          Geschätztes 1RM je Trainingstag dieser Übung, {series.length} Einheiten im Zeitraum.
                        </p>
                      </>
                    ) : (
                      <p className="py-4 text-center text-xs text-ink-600">
                        Noch zu wenige Trainingstage für einen Verlauf.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
