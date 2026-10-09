import { useState } from "react";
import { ChevronDown, Dumbbell, PauseCircle } from "lucide-react";
import type { LocalWorkoutLog } from "../../offline/db";
import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { estimateOneRepMax } from "../../lib/oneRepMax";
import { rangeCutoff, type ProgressRange } from "../../lib/progressRange";
import { formatDelta } from "../../lib/stats";
import { Badge, Card, EmptyState, Skeleton, cn } from "../ui";
import { Sparkline } from "./Sparkline";

const MAX_VISIBLE = 8;

// One 1RM value per day this exercise was trained (the day's best set), oldest first.
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

// "Plateau" means the best of the last 3 sessions never exceeded the best of everything before
// that — a simple, explainable check rather than a trend-line regression, which would overclaim
// precision a handful of session points can't support.
function isPlateau(series: number[]): boolean {
  if (series.length < 4) return false;
  return Math.max(...series.slice(-3)) <= Math.max(...series.slice(0, -3));
}

interface Row {
  exerciseId: string;
  exerciseName: string;
  oneRepMax: number | null;
  lastPerformedAt: string;
  series: number[];
}

export function StrengthCard({ range }: { range: ProgressRange }) {
  const { data: logs, isLoading } = useWorkoutLogs();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card title="Kraft und Rekorde">
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  const all = logs ?? [];
  const cutoff = rangeCutoff(range);
  const inRange = all.filter((l) => !cutoff || new Date(l.performedAt) >= cutoff);

  const byExercise = new Map<string, Row>();
  for (const log of inRange) {
    const existing = byExercise.get(log.exerciseId);
    if (!existing) {
      byExercise.set(log.exerciseId, {
        exerciseId: log.exerciseId,
        exerciseName: log.exerciseName,
        oneRepMax: null,
        lastPerformedAt: log.performedAt,
        series: [],
      });
    } else if (log.performedAt > existing.lastPerformedAt) {
      existing.lastPerformedAt = log.performedAt;
    }
  }
  for (const row of byExercise.values()) {
    row.series = sessionOneRepMaxSeries(inRange, row.exerciseId);
    row.oneRepMax = row.series.length > 0 ? Math.max(...row.series) : null;
  }

  const rows = [...byExercise.values()]
    .sort((a, b) => (a.lastPerformedAt < b.lastPerformedAt ? 1 : -1))
    .slice(0, MAX_VISIBLE);

  return (
    <Card title="Kraft und Rekorde">
      {rows.length === 0 ? (
        <EmptyState icon={<Dumbbell size={18} aria-hidden />} text="Keine Sätze in diesem Zeitraum." />
      ) : (
        <div>
          {rows.map((row) => {
            const plateau = isPlateau(sessionOneRepMaxSeries(all, row.exerciseId));
            const expanded = expandedId === row.exerciseId;
            const delta = row.series.length >= 2 ? row.series.at(-1)! - row.series[0] : null;
            const alt =
              row.series.length >= 2
                ? `${row.exerciseName}: geschätztes 1RM von ${Math.round(row.series[0])} auf ${Math.round(row.series.at(-1)!)} kg`
                : `${row.exerciseName}: zu wenige Datenpunkte`;
            return (
              <div key={row.exerciseId} className="border-t border-border-subtle first:border-t-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : row.exerciseId)}
                  className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-body font-medium text-text">{row.exerciseName}</span>
                      {plateau && (
                        <Badge tone="warning">
                          <PauseCircle size={12} aria-hidden /> Plateau
                        </Badge>
                      )}
                    </span>
                    <span className="tabular block text-small text-text-subtle">
                      {delta !== null ? `${formatDelta(delta, 1)} kg im Zeitraum` : "noch kein Verlauf"}
                    </span>
                  </span>
                  <span className="hidden w-24 shrink-0 sm:block">
                    <Sparkline values={row.series} tone={plateau ? "warning" : "accent"} label={alt} className="h-8 w-full" />
                  </span>
                  <span className="tabular w-20 shrink-0 text-right font-mono text-small text-text-2">
                    {row.oneRepMax !== null ? `≈ ${Math.round(row.oneRepMax)} kg` : "–"}
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className={cn("shrink-0 text-text-faint transition-transform", expanded && "rotate-180")}
                  />
                </button>
                {expanded && (
                  <div className="mb-3 rounded-lg bg-surface-2 p-3">
                    {row.series.length >= 2 ? (
                      <>
                        <Sparkline values={row.series} tone={plateau ? "warning" : "accent"} label={alt} />
                        <p className="mt-1 text-xs text-text-faint">
                          Geschätztes 1RM je Trainingstag, {row.series.length} Einheiten im Zeitraum. Bestwert{" "}
                          {Math.round(row.oneRepMax ?? 0)} kg.
                        </p>
                      </>
                    ) : (
                      <p className="py-3 text-center text-xs text-text-faint">
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
    </Card>
  );
}
