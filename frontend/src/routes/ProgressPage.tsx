import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { BodyDataCard } from "../components/progress/BodyDataCard";
import { StrengthCard } from "../components/progress/StrengthCard";
import { WeeklyDaysCard } from "../components/progress/WeeklyDaysCard";
import { SegmentedControl, StatTile } from "../components/ui";
import { useWeeklyPlanStatus } from "../hooks/usePlanExercises";
import { useTrainingPlan } from "../hooks/useTrainingPlan";
import { useWorkoutLogs } from "../hooks/useWorkoutLogs";
import {
  PROGRESS_RANGE_LABELS,
  PROGRESS_RANGE_SHORT,
  previousRangeCutoffs,
  rangeCutoff,
  type ProgressRange,
} from "../lib/progressRange";
import { formatDelta, longestWeekStreak, mondayOf, recordsBetween, trainedDaysBetween, volumeBetween } from "../lib/stats";
import { formatKg } from "../lib/trainingSets";

const RANGES = Object.keys(PROGRESS_RANGE_SHORT) as ProgressRange[];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Pure frontend aggregation over data that's already fetched elsewhere (body composition,
// workout logs via the offline-first cache) — no new backend endpoints. A single range
// selection drives every card on the page.
export function ProgressPage() {
  const [range, setRange] = useState<ProgressRange>("3m");
  const { data: logs } = useWorkoutLogs();
  const { data: plan } = useTrainingPlan();
  const { data: status } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", { enabled: !!plan });

  const all = logs ?? [];
  const now = new Date();
  const from = rangeCutoff(range) ?? (all.length > 0 ? new Date(Math.min(...all.map((l) => new Date(l.performedAt).getTime()))) : now);
  const inRange = all.filter((l) => new Date(l.performedAt) >= from);
  const weeksInRange = Math.max(1, (now.getTime() - mondayOf(from).getTime()) / WEEK_MS);
  const daysPerWeek = trainedDaysBetween(all, from, new Date(now.getTime() + 1)) / weeksInRange;
  const targetDays = status && status.days.length > 0 ? status.days.length : null;

  const volume = volumeBetween(all, from, new Date(now.getTime() + 1));
  const previous = previousRangeCutoffs(range);
  const previousVolume = previous ? volumeBetween(all, previous.start, previous.end) : 0;
  const volumeDelta = previousVolume > 0 ? ((volume - previousVolume) / previousVolume) * 100 : null;

  const records = recordsBetween(all, from, new Date(now.getTime() + 1));
  const streak = longestWeekStreak(inRange);

  return (
    <AppShell>
      <h1 className="mb-4 text-h1 text-text lg:text-h1-lg">Fortschritt</h1>
      <SegmentedControl
        label="Zeitraum"
        className="mb-4"
        value={range}
        onChange={setRange}
        options={RANGES.map((r) => ({ value: r, label: <span title={PROGRESS_RANGE_LABELS[r]}>{PROGRESS_RANGE_SHORT[r]}</span> }))}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Trainingstage / Woche"
          value={daysPerWeek.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
          sub={targetDays ? `Ziel ${targetDays}` : undefined}
          subTone={targetDays && daysPerWeek >= targetDays ? "accent" : "muted"}
        />
        <StatTile
          label="Volumen"
          value={formatKg(Math.round(volume))}
          unit="kg"
          sub={volumeDelta !== null ? `${formatDelta(Math.round(volumeDelta))} % zum Vorzeitraum` : undefined}
          subTone={volumeDelta !== null && volumeDelta >= 0 ? "accent" : "muted"}
        />
        <StatTile label="Neue Rekorde" value={records} />
        <StatTile label="Serie (längste)" value={streak} unit={streak === 1 ? "Woche" : "Wochen"} />
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <StrengthCard range={range} />
        <div className="flex flex-col gap-4">
          <WeeklyDaysCard targetDays={targetDays} />
          <BodyDataCard range={range} />
        </div>
      </div>
    </AppShell>
  );
}
