import { useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { useTrainingPlan } from "../../hooks/useTrainingPlan";
import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { formatValue } from "../../lib/chartScale";
import { getPhaseDisplayName } from "../../lib/phaseInfo";
import {
  CHART_METRICS,
  METRIC_INFO,
  buildSeries,
  exercisesInRange,
  phaseBands,
  type ChartMetric,
} from "../../lib/progressSeries";
import { rangeCutoff, type ProgressRange } from "../../lib/progressRange";
import { Button, Card, EmptyState, SegmentedControl, Select, Skeleton, cn } from "../ui";
import { ProgressChart, ProgressTable, type ChartSeries } from "./ProgressChart";

const MAX_SERIES = 3;
const QUICK_PICKS = 6;
const STORAGE_KEY = "progress-chart";

interface Choice {
  id: string;
  // Fixed per exercise while it stays selected: removing one never repaints the others.
  slot: number;
}

function loadSaved(): { metric: ChartMetric; selected: Choice[] } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { metric?: string; selected?: Choice[] } | null;
    const metric = CHART_METRICS.find((m) => m === raw?.metric) ?? "e1rm";
    const selected = (raw?.selected ?? []).filter((c) => typeof c.id === "string" && Number.isInteger(c.slot) && c.slot >= 0 && c.slot < MAX_SERIES).slice(0, MAX_SERIES);
    return { metric, selected };
  } catch {
    return { metric: "e1rm", selected: [] };
  }
}

// Progress over time: pick up to three exercises and one measure (estimated 1RM, best weight, volume,
// best reps) and see every training day as a line, with records marked and the training phases behind it.
export function ProgressChartCard({ range }: { range: ProgressRange }) {
  const { data: logs, isLoading } = useWorkoutLogs();
  const { data: plan } = useTrainingPlan();
  const [saved] = useState(loadSaved);
  const [metric, setMetric] = useState<ChartMetric>(saved.metric);
  const [selected, setSelected] = useState<Choice[]>(saved.selected);
  const [view, setView] = useState<"chart" | "table">("chart");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ metric, selected }));
    } catch {
      // not remembered, still works for this visit
    }
  }, [metric, selected]);

  const all = useMemo(() => logs ?? [], [logs]);
  const from = rangeCutoff(range);
  const exercises = useMemo(() => exercisesInRange(all, from), [all, from?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // What is shown: the chosen exercises that were trained in this range, else the one trained most often.
  const effective: Choice[] = useMemo(() => {
    const present = new Set(exercises.map((e) => e.exerciseId));
    const kept = selected.filter((c) => present.has(c.id));
    if (kept.length > 0 || exercises.length === 0) return kept;
    const top = [...exercises].sort((a, b) => b.days - a.days)[0];
    return [{ id: top.exerciseId, slot: 0 }];
  }, [selected, exercises]);

  const series: ChartSeries[] = useMemo(
    () =>
      effective.map((c) => ({
        id: c.id,
        label: exercises.find((e) => e.exerciseId === c.id)?.exerciseName ?? "Übung",
        color: `var(--chart-${c.slot + 1})`,
        points: buildSeries(all, c.id, metric, from),
      })),
    [effective, exercises, all, metric, from?.getTime()], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const domain = useMemo(() => {
    const to = Date.now();
    const first = series.flatMap((s) => s.points.map((p) => p.t));
    const start = from ? from.getTime() : first.length > 0 ? Math.min(...first) - 3 * 86_400_000 : to - 28 * 86_400_000;
    return { from: start, to };
  }, [series, from?.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const bands = useMemo(
    () =>
      plan
        ? phaseBands(plan.history, { phase: plan.currentPhase, startedOn: plan.phaseStartedOn }, (p) => getPhaseDisplayName(p as never, plan.phases), domain)
        : [],
    [plan, domain],
  );

  if (isLoading) {
    return (
      <Card title="Verlauf">
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  const info = METRIC_INFO[metric];
  const toggle = (id: string) => {
    setSelected((current) => {
      const base = current.length > 0 ? current : effective;
      if (base.some((c) => c.id === id)) return base.filter((c) => c.id !== id);
      if (base.length >= MAX_SERIES) return base;
      const free = [0, 1, 2].find((slot) => !base.some((c) => c.slot === slot)) ?? 0;
      return [...base, { id, slot: free }];
    });
  };
  const chosen = new Set(effective.map((c) => c.id));
  const quick = exercises.slice(0, QUICK_PICKS);
  const more = exercises.slice(QUICK_PICKS).filter((e) => !chosen.has(e.exerciseId));
  const primary = series[0];
  const first = primary?.points[0];
  const last = primary?.points.at(-1);
  const records = primary ? primary.points.filter((p) => p.record).length : 0;
  const withData = series.filter((s) => s.points.length > 0);

  return (
    <Card title="Verlauf">
      <SegmentedControl
        label="Messwert"
        value={metric}
        onChange={setMetric}
        options={CHART_METRICS.map((m) => ({ value: m, label: METRIC_INFO[m].short }))}
      />
      <p className="mt-2 text-xs text-text-faint">
        <span className="font-medium text-text-subtle">{info.label}.</span> {info.description}
      </p>

      {exercises.length === 0 ? (
        <EmptyState icon={<LineChart size={18} aria-hidden />} text="Keine Sätze in diesem Zeitraum." className="py-6" />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Übungen im Diagramm">
            {quick.map((e) => {
              const choice = effective.find((c) => c.id === e.exerciseId);
              return (
                <button
                  key={e.exerciseId}
                  type="button"
                  aria-pressed={!!choice}
                  onClick={() => toggle(e.exerciseId)}
                  className={cn(
                    "flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 text-small transition-colors duration-150",
                    choice ? "border-border-strong bg-surface-2 text-text" : "border-border text-text-subtle hover:bg-surface-2",
                  )}
                >
                  {choice && <span aria-hidden className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: `var(--chart-${choice.slot + 1})` }} />}
                  <span className="truncate">{e.exerciseName}</span>
                </button>
              );
            })}
            {more.length > 0 && (
              <Select
                aria-label="Weitere Übung hinzufügen"
                value=""
                onChange={(e) => e.target.value && toggle(e.target.value)}
                className="h-9 w-auto min-w-36 rounded-full text-small"
              >
                <option value="">Weitere Übung…</option>
                {more.map((e) => (
                  <option key={e.exerciseId} value={e.exerciseId}>
                    {e.exerciseName}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <p className="mt-1.5 text-xs text-text-faint">Bis zu drei Übungen vergleichen — jede behält ihre Farbe.</p>

          {withData.length === 0 ? (
            <EmptyState icon={<LineChart size={18} aria-hidden />} text={`Für „${info.label}“ gibt es in diesem Zeitraum keine Werte.`} className="py-6" />
          ) : (
            <>
              <div className="mt-3 flex items-center justify-between gap-2">
                <SegmentedControl
                  label="Darstellung"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "chart", label: "Diagramm" },
                    { value: "table", label: "Tabelle" },
                  ]}
                />
              </div>

              <div className="mt-3">
                {view === "chart" ? (
                  <ProgressChart
                    series={series}
                    bands={bands}
                    unit={info.unit}
                    domain={domain}
                    ariaLabel={`${info.label}: ${series.map((s) => s.label).join(", ")}`}
                  />
                ) : (
                  <ProgressTable series={series} unit={info.unit} />
                )}
              </div>

              {/* Legend for two or more series; one series is named by the title above. Text stays in text
                  colours, the short line beside it carries the identity. */}
              {series.length >= 2 && view === "chart" && (
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {series.map((s) => {
                    const lastPoint = s.points.at(-1);
                    return (
                      <li key={s.id} className="flex items-center gap-2 text-small">
                        <span aria-hidden className="h-0.5 w-4 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="text-text-2">{s.label}</span>
                        {lastPoint && <span className="tabular font-numeric text-text-subtle">{formatValue(lastPoint.value, info.unit)}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}

              {view === "chart" && (
                <p className="mt-2 text-xs text-text-faint">
                  Ein Ring um einen Punkt: neuer Rekord.{bands.length > 0 ? " Die Hintergrundstreifen zeigen deine Trainingsphasen." : ""}
                </p>
              )}

              {primary && first && last && primary.points.length >= 2 && (
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-small">
                  <div>
                    <dt className="text-text-subtle">Start</dt>
                    <dd className="tabular font-numeric text-text">{formatValue(first.value, info.unit)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-subtle">Jetzt</dt>
                    <dd className="tabular font-numeric text-text">{formatValue(last.value, info.unit)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-subtle">Rekorde</dt>
                    <dd className="tabular font-numeric text-text">{records}</dd>
                  </div>
                </dl>
              )}
              {series.length > 1 && <p className="mt-1 text-xs text-text-faint">Start, Jetzt und Rekorde beziehen sich auf {primary?.label}.</p>}
              {selected.length > 0 && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setSelected([])}>
                  Auswahl zurücksetzen
                </Button>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
