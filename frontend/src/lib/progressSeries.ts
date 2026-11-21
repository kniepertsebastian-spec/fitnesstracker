import { countsForRecords } from "./prDetection";
import { estimateOneRepMax } from "./oneRepMax";
import { utcDayKey } from "./dates";

// The data behind the progress chart: one value per training day for an exercise, in one of four
// measures, with the days that set a new record marked. Pure, so it is unit-tested.

export type ChartMetric = "e1rm" | "weight" | "volume" | "reps";

export const CHART_METRICS: ChartMetric[] = ["e1rm", "weight", "volume", "reps"];

export const METRIC_INFO: Record<ChartMetric, { short: string; label: string; unit: string; description: string }> = {
  e1rm: {
    short: "1RM",
    label: "Geschätztes 1RM",
    unit: "kg",
    description: "Das Gewicht, das du für eine einzelne Wiederholung schaffen würdest — aus dem besten Satz des Tages geschätzt.",
  },
  weight: {
    short: "Gewicht",
    label: "Bestes Gewicht",
    unit: "kg",
    description: "Das schwerste Gewicht, das du an dem Tag bewegt hast.",
  },
  volume: {
    short: "Volumen",
    label: "Volumen",
    unit: "kg",
    description: "Gewicht × Wiederholungen über alle Sätze des Tages.",
  },
  reps: {
    short: "Wdh.",
    label: "Beste Wiederholungszahl",
    unit: "Wdh.",
    description: "Die meisten Wiederholungen in einem Satz an dem Tag.",
  },
};

export interface SetLike {
  exerciseId: string;
  reps: number;
  weightKg: number;
  performedAt: string;
  technique?: Parameters<typeof countsForRecords>[0]["technique"];
  durationSeconds?: number | null;
}

export interface SeriesPoint {
  dayKey: string;
  // Midnight UTC of the day, in ms: the x position.
  t: number;
  value: number;
  // Beat every earlier day in this measure (counting days before the visible range too).
  record: boolean;
  sets: number;
}

const dayMs = (dayKey: string) => Date.parse(`${dayKey}T00:00:00Z`);

// The value of one measure for the sets of one day; null if the day has nothing to show for it
// (e.g. no 1RM from a bodyweight set without load).
function dayValue(sets: SetLike[], metric: ChartMetric): number | null {
  if (metric === "volume") {
    const timed = (s: SetLike) => !!s.durationSeconds;
    const sum = sets.filter((s) => !timed(s)).reduce((total, s) => total + s.weightKg * s.reps, 0);
    return sum > 0 ? sum : null;
  }
  // Partial reps, 21s and timed holds are not the same lift: they stay out of the records.
  const counting = sets.filter(countsForRecords);
  if (counting.length === 0) return null;
  if (metric === "weight") {
    const best = Math.max(...counting.map((s) => s.weightKg));
    return best > 0 ? best : null;
  }
  if (metric === "reps") return Math.max(...counting.map((s) => s.reps));
  const estimates = counting.map((s) => estimateOneRepMax(s.weightKg, s.reps)).filter((v): v is number => v !== null);
  return estimates.length > 0 ? Math.max(...estimates) : null;
}

// All training days of the exercise, oldest first. Records are decided on the whole history; `from`
// only cuts what is returned, so the first visible day is not a record just because the range starts there.
export function buildSeries(logs: SetLike[], exerciseId: string, metric: ChartMetric, from: Date | null = null): SeriesPoint[] {
  const byDay = new Map<string, SetLike[]>();
  for (const log of logs) {
    if (log.exerciseId !== exerciseId) continue;
    const key = utcDayKey(new Date(log.performedAt));
    byDay.set(key, [...(byDay.get(key) ?? []), log]);
  }
  const points: SeriesPoint[] = [];
  let best = -Infinity;
  for (const key of [...byDay.keys()].sort()) {
    const sets = byDay.get(key) as SetLike[];
    const value = dayValue(sets, metric);
    if (value === null) continue;
    points.push({ dayKey: key, t: dayMs(key), value, record: value > best, sets: sets.length });
    best = Math.max(best, value);
  }
  if (!from) return points;
  const cutoff = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return points.filter((p) => p.t >= cutoff);
}

export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  days: number;
  lastPerformedAt: string;
}

// Exercises trained in the visible range, the most recently trained first — what the picker offers.
export function exercisesInRange(
  logs: Array<SetLike & { exerciseName: string }>,
  from: Date | null,
): ExerciseSummary[] {
  const map = new Map<string, { name: string; days: Set<string>; last: string }>();
  for (const log of logs) {
    if (from && new Date(log.performedAt) < from) continue;
    const entry = map.get(log.exerciseId) ?? { name: log.exerciseName, days: new Set<string>(), last: log.performedAt };
    entry.days.add(utcDayKey(new Date(log.performedAt)));
    if (log.performedAt > entry.last) entry.last = log.performedAt;
    map.set(log.exerciseId, entry);
  }
  return [...map.entries()]
    .map(([exerciseId, e]) => ({ exerciseId, exerciseName: e.name, days: e.days.size, lastPerformedAt: e.last }))
    .sort((a, b) => (a.lastPerformedAt < b.lastPerformedAt ? 1 : -1));
}

export interface PhaseBand {
  label: string;
  from: number;
  to: number;
}

// The training phases as stretches of time: the finished ones from the plan's history and the current
// one up to now, cut to the visible window.
export function phaseBands(
  history: Array<{ phase: string; startedOn: string; endedOn: string | null }>,
  current: { phase: string; startedOn: string },
  labelOf: (phase: string) => string,
  window: { from: number; to: number },
): PhaseBand[] {
  const spans = [
    ...history.map((h) => ({ phase: h.phase, from: Date.parse(h.startedOn), to: h.endedOn ? Date.parse(h.endedOn) : window.to })),
    { phase: current.phase, from: Date.parse(current.startedOn), to: window.to },
  ].sort((a, b) => a.from - b.from);
  const bands: PhaseBand[] = [];
  for (const span of spans) {
    const from = Math.max(span.from, window.from);
    const to = Math.min(span.to, window.to);
    if (!(to > from)) continue;
    // Two stretches of the same phase in a row read as one.
    const last = bands.at(-1);
    if (last && last.label === labelOf(span.phase) && Math.abs(last.to - from) < 86_400_000) last.to = to;
    else bands.push({ label: labelOf(span.phase), from, to });
  }
  return bands;
}
