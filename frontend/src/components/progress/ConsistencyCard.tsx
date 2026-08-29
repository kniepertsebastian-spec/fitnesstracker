import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { rangeCutoff, type ProgressRange } from "../../lib/progressRange";

const MAX_VISIBLE_WEEKS = 12;

// Monday 00:00 UTC of the week containing `date` — same convention as the rest of the app
// (see planWeekStatus.service.ts's currentWeekMondayUtc for the backend equivalent).
function mondayOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

function weekKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Training frequency ("Konsistenz" / "Training Frequency") — how many distinct days per week
// were trained, not raw set count, so three quick sets on one day don't outweigh a single
// full session on another. A bar per week (days-trained out of 7) plus the current unbroken
// streak of weeks with at least one training day.
export function ConsistencyCard({ range }: { range: ProgressRange }) {
  const { data: logs, isLoading } = useWorkoutLogs();

  if (isLoading) return null;

  const cutoff = rangeCutoff(range);
  const inRange = (logs ?? []).filter((log) => !cutoff || new Date(log.performedAt) >= cutoff);

  const trainedDaysByWeek = new Map<string, Set<string>>();
  for (const log of inRange) {
    const performed = new Date(log.performedAt);
    const week = weekKey(mondayOfWeek(performed));
    const day = log.performedAt.slice(0, 10);
    const days = trainedDaysByWeek.get(week) ?? new Set<string>();
    days.add(day);
    trainedDaysByWeek.set(week, days);
  }

  const sortedWeeks = [...trainedDaysByWeek.keys()].sort();
  const visibleWeeks = sortedWeeks.slice(-MAX_VISIBLE_WEEKS);
  const weekCounts = visibleWeeks.map((week) => trainedDaysByWeek.get(week)?.size ?? 0);
  const avgDaysPerWeek =
    weekCounts.length > 0 ? weekCounts.reduce((sum, n) => sum + n, 0) / weekCounts.length : 0;

  // Walk backward week by week from the current week — counts as long as each week has at
  // least one trained day, stopping at the first gap.
  let streak = 0;
  const cursor = mondayOfWeek(new Date());
  for (;;) {
    const count = trainedDaysByWeek.get(weekKey(cursor))?.size ?? 0;
    if (count === 0) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  if (inRange.length === 0) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
        <p className="mb-1 text-sm font-medium text-ink-300">Konsistenz</p>
        <p className="text-sm text-ink-500">Keine Sätze in diesem Zeitraum.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-ink-300">Konsistenz</p>
        {streak > 0 && (
          <span className="text-xs text-emerald-400">
            🔥 {streak} {streak === 1 ? "Woche" : "Wochen"} in Folge
          </span>
        )}
      </div>
      <p className="text-lg font-semibold text-ink-100">
        {avgDaysPerWeek.toFixed(1)} <span className="text-sm font-normal text-ink-500">Trainingstage/Woche</span>
      </p>
      <div className="mt-3 flex items-end justify-between gap-1">
        {visibleWeeks.map((week, i) => (
          <div key={week} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-12 w-full items-end rounded bg-ink-800">
              <div
                className="w-full rounded bg-violet-600"
                style={{ height: `${(weekCounts[i] / 7) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-600">
        Trainierte Tage pro Woche, letzte {visibleWeeks.length} {visibleWeeks.length === 1 ? "Woche" : "Wochen"}.
      </p>
    </div>
  );
}
