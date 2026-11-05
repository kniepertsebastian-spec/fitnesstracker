import type { ScaleDetails } from "./schemas/scaleDetails.schema.js";

// Studies how a bioimpedance scale's numbers come about and how much they jump, from the
// measurements the app has stored. Pure and language-neutral: it returns structured findings, the
// wording is up to the screen that shows them.
//
// Three questions, answered from the data alone:
//  1. Noise: readings taken within an hour of each other (same weight, same person) should agree.
//     How far do they spread, per value?
//  2. Derivation: which reported values are just a fixed share of another one (or a sum or
//     difference of others)? Those are no independent measurements; their noise is shared.
//  3. Drivers: once there are enough readings with the raw impedances, which impedance channel
//     moves together with the body-fat result?

export interface ScaleReading {
  measuredAt: string;
  weightKg: number;
  bodyFatPercent: number | null;
  muscleMassKg: number | null;
  bodyWaterPercent: number | null;
  details: ScaleDetails | null;
}

export interface ScaleMetric {
  key: string;
  label: string;
  unit: string;
  kind: "value" | "impedance";
  get: (reading: ScaleReading) => number | null;
}

const fatMassOf = (r: ScaleReading): number | null =>
  r.details?.fatMassKg ?? (r.bodyFatPercent === null ? null : (r.weightKg * r.bodyFatPercent) / 100);
const fatFreeOf = (r: ScaleReading): number | null => {
  if (r.details?.fatFreeMassKg !== undefined) return r.details.fatFreeMassKg;
  const fat = fatMassOf(r);
  return fat === null ? null : r.weightKg - fat;
};
const waterKgOf = (r: ScaleReading): number | null =>
  r.details?.waterKg ?? (r.bodyWaterPercent === null ? null : (r.weightKg * r.bodyWaterPercent) / 100);

const IMPEDANCE_SEGMENTS = [
  ["rightArm", "Rechter Arm"],
  ["leftArm", "Linker Arm"],
  ["trunk", "Rumpf"],
  ["rightLeg", "Rechtes Bein"],
  ["leftLeg", "Linkes Bein"],
] as const;

export const SCALE_METRICS: ScaleMetric[] = [
  { key: "weightKg", label: "Gewicht", unit: "kg", kind: "value", get: (r) => r.weightKg },
  { key: "bodyFatPercent", label: "Körperfett", unit: "%", kind: "value", get: (r) => r.bodyFatPercent },
  { key: "fatMassKg", label: "Fettmasse", unit: "kg", kind: "value", get: fatMassOf },
  { key: "fatFreeMassKg", label: "Fettfreie Masse", unit: "kg", kind: "value", get: fatFreeOf },
  { key: "muscleMassKg", label: "Muskelmasse", unit: "kg", kind: "value", get: (r) => r.muscleMassKg },
  { key: "skeletalMuscleKg", label: "Skelettmuskel", unit: "kg", kind: "value", get: (r) => r.details?.skeletalMuscleKg ?? null },
  { key: "waterKg", label: "Wasser", unit: "kg", kind: "value", get: waterKgOf },
  { key: "proteinKg", label: "Eiweiß", unit: "kg", kind: "value", get: (r) => r.details?.proteinKg ?? null },
  { key: "boneMassKg", label: "Knochenmasse", unit: "kg", kind: "value", get: (r) => r.details?.boneMassKg ?? null },
  { key: "subcutaneousFatPercent", label: "Subkutanes Fett", unit: "%", kind: "value", get: (r) => r.details?.subcutaneousFatPercent ?? null },
  { key: "visceralFat", label: "Viszeralfett", unit: "", kind: "value", get: (r) => r.details?.visceralFat ?? null },
  { key: "basalMetabolicRateKcal", label: "Grundumsatz", unit: "kcal", kind: "value", get: (r) => r.details?.basalMetabolicRateKcal ?? null },
  { key: "bodyAge", label: "Körperalter", unit: "Jahre", kind: "value", get: (r) => r.details?.bodyAge ?? null },
  { key: "asmi", label: "ASMI", unit: "kg/m²", kind: "value", get: (r) => r.details?.asmi ?? null },
  { key: "waistHipRatio", label: "WHR", unit: "", kind: "value", get: (r) => r.details?.waistHipRatio ?? null },
  { key: "score", label: "Körperpunktzahl", unit: "Punkte", kind: "value", get: (r) => r.details?.score ?? null },
  ...(["khz20", "khz100"] as const).flatMap((band) =>
    IMPEDANCE_SEGMENTS.map(([segment, label]) => ({
      key: `${band}.${segment}`,
      label: `${label} ${band === "khz20" ? "20 kHz" : "100 kHz"}`,
      unit: "Ω",
      kind: "impedance" as const,
      get: (r: ScaleReading) => r.details?.impedance?.[band]?.[segment] ?? null,
    })),
  ),
];

// --- statistics ---------------------------------------------------------------------------------

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function sampleSd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((sum, x) => sum + (x - m) ** 2, 0) / (xs.length - 1));
}

const coefficientOfVariation = (xs: number[]) => (sampleSd(xs) / Math.abs(mean(xs))) * 100;

function pearson(xs: number[], ys: number[]): number | null {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}

const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

// --- result types -------------------------------------------------------------------------------

export interface ScaleSession {
  start: string;
  end: string;
  readings: number;
}

export interface NoiseRow {
  key: string;
  label: string;
  unit: string;
  kind: "value" | "impedance";
  // Pooled standard deviation of readings taken within one session.
  sd: number;
  // Largest spread (max - min) seen inside one session.
  maxRange: number;
  // Number of within-session comparisons the figure rests on (readings minus one, per session).
  repeats: number;
  // Standard deviation between the session averages; null with fewer than three sessions.
  betweenSd: number | null;
}

export interface DerivedRow {
  key: string;
  label: string;
  unit: string;
  relation: "identity" | "ratio" | "linear";
  // identity: the formula in words; ratio/linear: what it was compared to.
  basis: string;
  // ratio: target = ratio x base. linear: target = intercept + slope x base.
  ratio?: number;
  slope?: number;
  intercept?: number;
  // Residual spread of the relation, in percent of the target (ratio) or R² (linear).
  spreadPercent?: number;
  r2?: number;
  n: number;
}

export interface DriverRow {
  channelKey: string;
  channelLabel: string;
  r: number;
}

export interface ScaleAnalysis {
  readings: number;
  withDetails: number;
  withImpedance: number;
  sessions: ScaleSession[];
  repeatSessions: number;
  noise: NoiseRow[];
  derived: DerivedRow[];
  // Reported values for which no derivation was found (yet).
  independent: { key: string; label: string }[];
  // Impedance channels that move with body fat, strongest first; empty until enough readings.
  drivers: DriverRow[];
  driversNeeded: number;
}

// --- analysis -----------------------------------------------------------------------------------

export const SESSION_GAP_MINUTES = 60;
const MIN_READINGS_FOR_DRIVERS = 6;

export function groupSessions(readings: ScaleReading[]): ScaleReading[][] {
  const sorted = [...readings].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const sessions: ScaleReading[][] = [];
  for (const reading of sorted) {
    const last = sessions.at(-1);
    const previous = last?.at(-1);
    const gap = previous ? new Date(reading.measuredAt).getTime() - new Date(previous.measuredAt).getTime() : Infinity;
    if (last && gap <= SESSION_GAP_MINUTES * 60_000) last.push(reading);
    else sessions.push([reading]);
  }
  return sessions;
}

function noiseRows(sessions: ScaleReading[][]): NoiseRow[] {
  const repeatSessions = sessions.filter((s) => s.length >= 2);
  const rows: NoiseRow[] = [];
  for (const metric of SCALE_METRICS) {
    let squares = 0;
    let degrees = 0;
    let maxRange = 0;
    for (const session of repeatSessions) {
      const values = session.map(metric.get).filter((v): v is number => v !== null);
      if (values.length < 2) continue;
      const m = mean(values);
      squares += values.reduce((sum, v) => sum + (v - m) ** 2, 0);
      degrees += values.length - 1;
      maxRange = Math.max(maxRange, Math.max(...values) - Math.min(...values));
    }
    if (degrees === 0) continue;
    const sessionMeans = sessions
      .map((s) => s.map(metric.get).filter((v): v is number => v !== null))
      .filter((v) => v.length > 0)
      .map(mean);
    rows.push({
      key: metric.key,
      label: metric.label,
      unit: metric.unit,
      kind: metric.kind,
      sd: round(Math.sqrt(squares / degrees), 2),
      maxRange: round(maxRange, 2),
      repeats: degrees,
      betweenSd: sessionMeans.length >= 3 ? round(sampleSd(sessionMeans), 2) : null,
    });
  }
  return rows;
}

// Exact relations between reported values (to the rounding of one decimal).
const IDENTITIES: {
  key: string;
  from: string[];
  formula: string;
  tolerance: number;
  residual: (r: ScaleReading) => number | null;
}[] = [
  {
    key: "fatFreeMassKg",
    from: ["weightKg", "fatMassKg"],
    formula: "Gewicht − Fettmasse",
    tolerance: 0.25,
    residual: (r) => (r.details?.fatFreeMassKg !== undefined && r.details.fatMassKg !== undefined ? r.details.fatFreeMassKg - (r.weightKg - r.details.fatMassKg) : null),
  },
  {
    key: "bodyFatPercent",
    from: ["fatMassKg", "weightKg"],
    formula: "Fettmasse ÷ Gewicht",
    tolerance: 0.1,
    residual: (r) => (r.bodyFatPercent !== null && r.details?.fatMassKg !== undefined ? r.bodyFatPercent - (r.details.fatMassKg / r.weightKg) * 100 : null),
  },
  {
    key: "muscleMassKg",
    from: ["fatFreeMassKg", "boneMassKg"],
    formula: "fettfreie Masse − Knochenmasse",
    tolerance: 0.2,
    residual: (r) => (r.muscleMassKg !== null && r.details?.fatFreeMassKg !== undefined && r.details.boneMassKg !== undefined ? r.muscleMassKg - (r.details.fatFreeMassKg - r.details.boneMassKg) : null),
  },
  {
    key: "waterKg",
    from: ["fatFreeMassKg", "proteinKg", "boneMassKg"],
    formula: "fettfreie Masse − Eiweiß − Knochenmasse",
    tolerance: 0.3,
    residual: (r) =>
      r.details?.waterKg !== undefined && r.details.fatFreeMassKg !== undefined && r.details.proteinKg !== undefined && r.details.boneMassKg !== undefined
        ? r.details.waterKg - (r.details.fatFreeMassKg - r.details.proteinKg - r.details.boneMassKg)
        : null,
  },
];

// Bases a value can be a share of, most fundamental first.
const BASE_KEYS = ["fatFreeMassKg", "weightKg", "bodyFatPercent", "fatMassKg", "muscleMassKg", "skeletalMuscleKg"];
// The two values everything else hangs on: they are never explained by a share of something else.
const ROOT_KEYS = new Set(["fatFreeMassKg", "fatMassKg"]);
const EPSILON = 1e-6;
const PREFER_EARLIER_BASE_WITHIN = 0.3; // percentage points of spread

interface Candidate {
  row: DerivedRow;
  score: number;
}

// How a target follows a base: a fixed share (ratio) or a straight line with an offset (linear).
// Returns null when the data show no such relation.
function relationTo(target: ScaleMetric, base: ScaleMetric, readings: ScaleReading[]): Candidate | null {
  const pairs = readings
    .map((r) => [base.get(r), target.get(r)] as const)
    .filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null && p[0] !== 0);
  if (pairs.length < 3) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const targetCv = coefficientOfVariation(ys);
  // A value that barely moves cannot show whether it follows another one.
  if (!(targetCv >= 1.5)) return null;

  const ratios = pairs.map((p) => p[1] / p[0]);
  const ratioCv = coefficientOfVariation(ratios);
  const ratioFits = ratioCv <= Math.min(1.5, Math.max(0.8, targetCv / 5));

  let linear: { slope: number; intercept: number; r2: number; spreadPercent: number } | null = null;
  const r = pairs.length >= 5 ? pearson(xs, ys) : null;
  if (r !== null && r * r >= 0.995) {
    const slope = (r * sampleSd(ys)) / sampleSd(xs);
    const intercept = mean(ys) - slope * mean(xs);
    const residuals = pairs.map((p) => p[1] - (intercept + slope * p[0]));
    linear = { slope, intercept, r2: r * r, spreadPercent: (Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / (pairs.length - 2)) / mean(ys)) * 100 };
  }

  const common = { key: target.key, label: target.label, unit: target.unit, basis: base.label, n: pairs.length };
  // A line with an offset counts only when it explains the data clearly better than a plain share.
  if (linear && (!ratioFits || linear.spreadPercent < ratioCv / 2)) {
    return {
      score: linear.spreadPercent,
      row: { ...common, relation: "linear", slope: round(linear.slope, 4), intercept: round(linear.intercept, 2), r2: round(linear.r2, 4) },
    };
  }
  if (ratioFits) return { score: ratioCv, row: { ...common, relation: "ratio", ratio: round(mean(ratios), 4), spreadPercent: round(ratioCv, 2) } };
  return null;
}

function derivedRows(readings: ScaleReading[]): DerivedRow[] {
  const rows: DerivedRow[] = [];
  const inputsOf = new Map<string, string[]>(); // derived key -> the keys it was derived from
  const byKey = new Map(SCALE_METRICS.map((m) => [m.key, m]));

  for (const identity of IDENTITIES) {
    const residuals = readings.map(identity.residual).filter((v): v is number => v !== null);
    if (residuals.length < 2 || !residuals.every((v) => Math.abs(v) <= identity.tolerance + EPSILON)) continue;
    const metric = byKey.get(identity.key)!;
    rows.push({ key: metric.key, label: metric.label, unit: metric.unit, relation: "identity", basis: identity.formula, n: residuals.length });
    inputsOf.set(metric.key, identity.from);
  }

  for (const target of SCALE_METRICS.filter((m) => m.kind === "value" && m.key !== "weightKg")) {
    if (inputsOf.has(target.key) || ROOT_KEYS.has(target.key)) continue;
    const candidates: (Candidate & { baseKey: string })[] = [];
    for (const baseKey of BASE_KEYS) {
      if (baseKey === target.key) continue;
      // Never explain a value by one that was itself derived from it.
      if (inputsOf.get(baseKey)?.includes(target.key)) continue;
      const found = relationTo(target, byKey.get(baseKey)!, readings);
      if (found) candidates.push({ ...found, baseKey });
    }
    if (candidates.length === 0) continue;
    const bestScore = Math.min(...candidates.map((c) => c.score));
    // Candidates are in order of how fundamental the base is: take the first that is nearly as good.
    const chosen = candidates.find((c) => c.score <= bestScore + PREFER_EARLIER_BASE_WITHIN)!;
    rows.push(chosen.row);
    inputsOf.set(target.key, [chosen.baseKey]);
  }
  return rows;
}

function drivers(readings: ScaleReading[]): { rows: DriverRow[]; needed: number } {
  const withImpedance = readings.filter((r) => r.details?.impedance && r.bodyFatPercent !== null);
  if (withImpedance.length < MIN_READINGS_FOR_DRIVERS) return { rows: [], needed: MIN_READINGS_FOR_DRIVERS - withImpedance.length };
  const fat = withImpedance.map((r) => r.bodyFatPercent as number);
  const rows: DriverRow[] = [];
  for (const channel of SCALE_METRICS.filter((m) => m.kind === "impedance")) {
    const pairs = withImpedance.map((r, i) => [channel.get(r), fat[i]] as const).filter((p): p is readonly [number, number] => p[0] !== null);
    if (pairs.length < MIN_READINGS_FOR_DRIVERS) continue;
    const r = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
    if (r !== null) rows.push({ channelKey: channel.key, channelLabel: channel.label, r: round(r, 2) });
  }
  return { rows: rows.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 4), needed: 0 };
}

export interface SessionAverage {
  readings: number;
  from: string;
  to: string;
  weightKg: number;
  bodyFatPercent: number | null;
  muscleMassKg: number | null;
  bodyWaterPercent: number | null;
  // Largest minus smallest body fat reading of the session; null with fewer than two readings.
  bodyFatRange: number | null;
}

// The mean of the newest session, i.e. of the weigh-ins in a row. Random scatter between readings
// shrinks with the square root of their number; a bias of the scale does not. Every value is
// averaged on its own: the sums and fixed shares between the values survive that.
export function latestSessionAverage(readings: ScaleReading[]): SessionAverage | null {
  const session = groupSessions(readings).at(-1);
  if (!session) return null;
  const meanOf = (get: (r: ScaleReading) => number | null, digits: number): number | null => {
    const values = session.map(get).filter((v): v is number => v !== null);
    return values.length === 0 ? null : round(mean(values), digits);
  };
  const fats = session.map((r) => r.bodyFatPercent).filter((v): v is number => v !== null);
  return {
    readings: session.length,
    from: session[0].measuredAt,
    to: session.at(-1)!.measuredAt,
    weightKg: round(mean(session.map((r) => r.weightKg)), 2),
    bodyFatPercent: meanOf((r) => r.bodyFatPercent, 1),
    muscleMassKg: meanOf((r) => r.muscleMassKg, 1),
    bodyWaterPercent: meanOf((r) => r.bodyWaterPercent, 1),
    bodyFatRange: fats.length >= 2 ? round(Math.max(...fats) - Math.min(...fats), 1) : null,
  };
}

export function analyzeScaleReadings(readings: ScaleReading[]): ScaleAnalysis {
  const sessions = groupSessions(readings);
  const derived = derivedRows(readings);
  const derivedKeys = new Set(derived.map((d) => d.key));
  const withData = (key: string) => readings.some((r) => SCALE_METRICS.find((m) => m.key === key)!.get(r) !== null);
  const { rows: driverRows, needed } = drivers(readings);
  return {
    readings: readings.length,
    withDetails: readings.filter((r) => r.details !== null).length,
    withImpedance: readings.filter((r) => r.details?.impedance).length,
    sessions: sessions.map((s) => ({ start: s[0].measuredAt, end: s.at(-1)!.measuredAt, readings: s.length })),
    repeatSessions: sessions.filter((s) => s.length >= 2).length,
    noise: noiseRows(sessions),
    derived,
    independent: SCALE_METRICS.filter((m) => m.kind === "value" && !derivedKeys.has(m.key) && withData(m.key)).map((m) => ({ key: m.key, label: m.label })),
    drivers: driverRows,
    driversNeeded: needed,
  };
}
