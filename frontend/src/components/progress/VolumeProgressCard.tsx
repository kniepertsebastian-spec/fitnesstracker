import type { LocalWorkoutLog } from "../../offline/db";
import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { previousRangeCutoffs, rangeCutoff, type ProgressRange } from "../../lib/progressRange";

function totalVolume(logs: LocalWorkoutLog[], from: Date | null, to?: Date): number {
  return logs
    .filter((log) => {
      const d = new Date(log.performedAt);
      return (!from || d >= from) && (!to || d < to);
    })
    .reduce((sum, log) => sum + log.reps * log.weightKg, 0);
}

// Total training volume (Σ reps × weight across every logged set) for the selected range, plus a
// "vs. the equally-long period right before it" trend — "all" has no meaningful prior period to
// compare against, so the trend line is simply omitted there.
export function VolumeProgressCard({ range }: { range: ProgressRange }) {
  const { data: logs, isLoading } = useWorkoutLogs();

  if (isLoading) return null;

  const allLogs = logs ?? [];
  const current = totalVolume(allLogs, rangeCutoff(range));

  const previous = previousRangeCutoffs(range);
  const previousVolume = previous ? totalVolume(allLogs, previous.start, previous.end) : null;
  const deltaPercent =
    previousVolume !== null && previousVolume > 0
      ? ((current - previousVolume) / previousVolume) * 100
      : null;

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="mb-1 text-sm font-medium text-ink-300">Trainingsvolumen</p>
      <p className="text-lg font-semibold text-ink-100">
        {Math.round(current).toLocaleString("de-DE")} kg
      </p>
      {deltaPercent !== null && (
        <p className="text-sm text-ink-500">
          {deltaPercent >= 0 ? "↑" : "↓"} {Math.abs(Math.round(deltaPercent))}% ggü. Vorperiode
        </p>
      )}
      <p className="mt-1 text-xs text-ink-600">Summe aus Gewicht × Wiederholungen über alle Sätze im Zeitraum.</p>
    </div>
  );
}
