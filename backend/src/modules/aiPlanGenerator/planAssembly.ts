// Pure plan-assembly logic for the AI generator — split structure, the catalog sent to the
// model, and the server-side check of what comes back. No DB access, so it's unit-testable.
import type { EquipmentTag, SplitPreference } from "@fitnesstracker/shared";

export interface SplitDay {
  label: string;
  // free-exercise-db primary-muscle names this day trains; drives catalog balance, the day's
  // focus check and the fill-up of missing exercises.
  muscles: string[];
}

const CORE = ["abdominals"];
const LEG_MUSCLES = ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"];
const ALL_MUSCLES = [
  "chest", "lats", "middle back", "shoulders", "biceps", "triceps", "traps", "forearms",
  "lower back", ...LEG_MUSCLES, ...CORE, "neck",
];

const FULL_BODY: SplitDay = { label: "Ganzkörper", muscles: ALL_MUSCLES };
const UPPER: SplitDay = {
  label: "Oberkörper",
  muscles: ["chest", "lats", "middle back", "shoulders", "biceps", "triceps", "traps", "forearms"],
};
const LOWER: SplitDay = { label: "Unterkörper", muscles: [...LEG_MUSCLES, "lower back", ...CORE] };
const PUSH: SplitDay = { label: "Push (Brust, Schultern, Trizeps)", muscles: ["chest", "shoulders", "triceps"] };
const PULL: SplitDay = {
  label: "Pull (Rücken, Bizeps)",
  muscles: ["lats", "middle back", "traps", "biceps", "forearms", "lower back"],
};
const LEGS: SplitDay = { label: "Legs (Beine)", muscles: [...LEG_MUSCLES, ...CORE] };
const BRO: SplitDay[] = [
  { label: "Brust", muscles: ["chest"] },
  { label: "Rücken", muscles: ["lats", "middle back", "traps", "lower back"] },
  { label: "Beine", muscles: [...LEG_MUSCLES, ...CORE] },
  { label: "Schultern", muscles: ["shoulders", "traps"] },
  { label: "Arme", muscles: ["biceps", "triceps", "forearms"] },
];

const BASES: Record<Exclude<SplitPreference, "auto">, SplitDay[]> = {
  full_body: [FULL_BODY],
  upper_lower: [UPPER, LOWER],
  push_pull_legs: [PUSH, PULL, LEGS],
  bro_split: BRO,
};

// "auto" keeps the previous frequency-based choice.
function autoBase(frequency: number): SplitDay[] {
  if (frequency <= 1) return [FULL_BODY];
  if (frequency === 2 || frequency === 4) return [UPPER, LOWER];
  if (frequency === 5) return BRO;
  return [PUSH, PULL, LEGS];
}

// One split day per weekly session: the weekly plan status starts every week at the first day
// not yet trained, so days beyond the weekly frequency would never come up. The base template is
// cycled to that length; repeated day types get an A/B/C suffix so dayLabels stay unique
// (PlanExercise is unique per (phase, exercise, dayLabel)).
export function resolveSplit(split: SplitPreference, frequencyPerWeek: number): SplitDay[] {
  const frequency = Math.min(6, Math.max(1, Math.round(frequencyPerWeek)));
  const base = split === "auto" ? autoBase(frequency) : BASES[split];
  const days = Array.from({ length: frequency }, (_, i) => base[i % base.length]);
  const repeats = new Map<string, number>();
  for (const d of days) repeats.set(d.label, (repeats.get(d.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return days.map((d) => {
    if ((repeats.get(d.label) ?? 0) < 2) return d;
    const n = seen.get(d.label) ?? 0;
    seen.set(d.label, n + 1);
    const suffix = String.fromCharCode(65 + n);
    // "Push (Brust, …)" → "Push A (Brust, …)"; "Brust" → "Brust A".
    const paren = d.label.indexOf(" (");
    const label = paren === -1 ? `${d.label} ${suffix}` : `${d.label.slice(0, paren)} ${suffix}${d.label.slice(paren)}`;
    return { ...d, label };
  });
}

// --- Equipment ---------------------------------------------------------------------------

// free-exercise-db's raw equipment value → the questionnaire tag that allows it.
export function equipmentTagOf(equipment: string | null): EquipmentTag {
  if (!equipment) return "other";
  const value = equipment.toLowerCase();
  if (value === "e-z curl bar") return "barbell";
  return (
    ["machine", "dumbbell", "barbell", "cable", "body only", "kettlebells", "bands", "medicine ball", "exercise ball", "foam roll"] as const
  ).find((tag) => tag === value) ?? "other";
}

// --- Catalog -----------------------------------------------------------------------------

export interface CatalogRow {
  id: string;
  name: string;
  nameDe: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  category?: string | null;
}

export const MAX_CATALOG_ENTRIES = 150;
const MIN_PER_MUSCLE = 6;

// The gym staples, by exact free-exercise-db name — always first in their muscle's share.
const STAPLE_NAMES = new Set([
  "barbell squat", "front squat (clean grip)", "leg press", "hack squat", "goblet squat", "dumbbell lunges",
  "split squat with dumbbells", "leg extensions", "lying leg curls", "seated leg curl", "romanian deadlift",
  "barbell deadlift", "barbell hip thrust", "barbell glute bridge", "standing calf raises", "seated calf raise",
  "thigh abductor", "thigh adductor", "wide-grip lat pulldown", "close-grip front lat pulldown", "pullups",
  "chin-up", "seated cable rows", "bent over barbell row", "one-arm dumbbell row", "t-bar row with handle",
  "barbell bench press - medium grip", "barbell incline bench press - medium grip", "dumbbell bench press",
  "incline dumbbell press", "pushups", "dips - chest version", "cable crossover", "dumbbell flyes", "butterfly",
  "standing military press", "seated dumbbell press", "machine shoulder (military) press", "side lateral raise",
  "face pull", "reverse flyes", "barbell shrug", "barbell curl", "dumbbell bicep curl", "hammer curls",
  "preacher curl", "cable preacher curl", "triceps pushdown", "triceps pushdown - rope attachment",
  "ez-bar skullcrusher", "lying triceps press", "dips - triceps version", "hyperextensions (back extensions)",
  "cable crunch", "plank", "hanging leg raise", "crunches",
]);
// Variants that rarely belong in a regular gym plan.
const EXOTIC_KEYWORDS = ["jump", "bosu", "kneeling", "with bands", "zottman", "finger", "jerk", "snatch", "clean", "sled", "tire"];
const LOW_PRIORITY_CATEGORIES = new Set(["plyometrics", "olympic weightlifting", "strongman"]);
// Common movement patterns — a weaker bonus than STAPLE_NAMES, for close variants.
const STAPLE_KEYWORDS = [
  "bench press", "squat", "deadlift", "row", "pulldown", "pullup", "pull-up", "chin-up", "chin up",
  "leg press", "lunge", "shoulder press", "military press", "overhead press", "lateral raise",
  "curl", "pushdown", "triceps extension", "skullcrusher", "dip", "hip thrust", "glute bridge",
  "leg curl", "leg extension", "calf raise", "fly", "flye", "face pull", "romanian", "push-up",
  "pushup", "crunch", "plank", "shrug", "rear delt", "step-up", "good morning", "hyperextension",
];
const EQUIPMENT_SCORE: Partial<Record<EquipmentTag, number>> = {
  barbell: 12,
  dumbbell: 12,
  machine: 10,
  cable: 10,
  "body only": 6,
};

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function scoreExercise(row: CatalogRow, loggedCount: number): number {
  const name = row.name.toLowerCase();
  const staple = STAPLE_NAMES.has(name) ? 300 : STAPLE_KEYWORDS.some((k) => name.includes(k)) ? 40 : 0;
  const exotic = EXOTIC_KEYWORDS.some((k) => name.includes(k)) ? -60 : 0;
  const category = row.category && LOW_PRIORITY_CATEGORIES.has(row.category.toLowerCase()) ? -80 : 0;
  const logged = loggedCount > 0 ? 1000 + Math.min(loggedCount, 500) : 0;
  return logged + staple + exotic + category + (EQUIPMENT_SCORE[equipmentTagOf(row.equipment)] ?? 0);
}

// The previous selection took the first 150 rows in database order — alphabetically A–C for a
// full gym, so leg press, lat pulldown or cable rows were never offered. Instead every muscle the
// split trains gets an even share of the slots, filled by score (logged exercises first, then
// staples), with a seeded tiebreak so the same request gives the same catalog.
export function selectBalancedCatalog(
  rows: CatalogRow[],
  muscles: string[],
  loggedCounts: Map<string, number>,
  seed: string,
  max = MAX_CATALOG_ENTRIES,
): CatalogRow[] {
  const ranked = rows
    .map((row) => ({ row, score: scoreExercise(row, loggedCounts.get(row.id) ?? 0), tie: hash(`${seed}:${row.id}`) }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie);

  const byMuscle = new Map<string, CatalogRow[]>();
  for (const { row } of ranked) {
    const muscle = row.primaryMuscles[0];
    if (!muscle || !muscles.includes(muscle)) continue;
    const bucket = byMuscle.get(muscle) ?? [];
    bucket.push(row);
    byMuscle.set(muscle, bucket);
  }

  const present = muscles.filter((m) => byMuscle.has(m));
  if (present.length === 0) return [];
  const perMuscle = Math.max(MIN_PER_MUSCLE, Math.floor(max / present.length));
  const picked: CatalogRow[] = [];
  const pickedIds = new Set<string>();
  // Round-robin by rank, so a cap below perMuscle × muscles still spreads evenly.
  for (let rank = 0; rank < perMuscle && picked.length < max; rank++) {
    for (const muscle of present) {
      const row = byMuscle.get(muscle)?.[rank];
      if (row && !pickedIds.has(row.id) && picked.length < max) {
        picked.push(row);
        pickedIds.add(row.id);
      }
    }
  }
  // Logged exercises outside the split's muscles (e.g. a neck exercise) stay out on purpose.
  return picked;
}

// --- Response check ------------------------------------------------------------------------

export interface PhaseDefaults {
  sets: number;
  repMin: number;
  repMax: number;
  rir: number;
  restSeconds: number;
}

export interface RawPlanItem {
  day: string;
  exerciseId: string;
  targetSets: number;
  repRangeMin?: number | null;
  repRangeMax?: number | null;
  targetReps?: number | null;
  targetRir?: number | null;
  restSeconds?: number | null;
  cue?: string | null;
  alternativeExerciseId?: string | null;
  order: number;
}

export interface AssembledItem {
  day: string;
  exerciseId: string;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  targetRir: number;
  restSeconds: number;
  notes: string | null;
  alternativeExerciseId: string | null;
  filledByServer: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

function normalize(item: RawPlanItem, defaults: PhaseDefaults, catalogById: Map<string, CatalogRow>): AssembledItem {
  let repMin = item.repRangeMin ?? item.targetReps ?? defaults.repMin;
  let repMax = item.repRangeMax ?? item.targetReps ?? defaults.repMax;
  if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
  // An alternative only helps if it trains the same main muscle (it backs the in-workout swap).
  const alt = item.alternativeExerciseId ? catalogById.get(item.alternativeExerciseId) : undefined;
  const ownMuscle = catalogById.get(item.exerciseId)?.primaryMuscles[0];
  const validAlt = alt && alt.id !== item.exerciseId && alt.primaryMuscles[0] === ownMuscle ? alt.id : null;
  return {
    day: item.day,
    exerciseId: item.exerciseId,
    targetSets: clamp(item.targetSets, 1, 10),
    repRangeMin: clamp(repMin, 1, 50),
    repRangeMax: clamp(repMax, 1, 50),
    targetRir: clamp(item.targetRir ?? defaults.rir, 0, 5),
    restSeconds: clamp(item.restSeconds ?? defaults.restSeconds, 15, 600),
    notes: item.cue?.trim() ? item.cue.trim().slice(0, 300) : null,
    alternativeExerciseId: validAlt,
    filledByServer: false,
  };
}

// The model is asked for exactly `perDay` exercises per day from the catalog, matching the day's
// focus — and doesn't always deliver. Invalid ids/days, off-focus picks and same-day duplicates
// are dropped, surplus is cut, and missing slots are filled from the catalog (preferring muscles
// the day doesn't cover yet) with the phase's default sets/reps.
export function assembleDays(
  raw: RawPlanItem[],
  days: SplitDay[],
  catalog: CatalogRow[],
  perDay: number,
  defaults: PhaseDefaults,
  loggedCounts: Map<string, number> = new Map(),
): AssembledItem[] {
  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const result: AssembledItem[] = [];

  for (const day of days) {
    const focus = new Set(day.muscles);
    const items: AssembledItem[] = [];
    const used = new Set<string>();
    const fromModel = raw.filter((r) => r.day === day.label).sort((a, b) => a.order - b.order);
    for (const item of fromModel) {
      const exercise = catalogById.get(item.exerciseId);
      if (!exercise || used.has(exercise.id)) continue;
      if (!exercise.primaryMuscles.some((m) => focus.has(m))) continue;
      items.push(normalize(item, defaults, catalogById));
      used.add(exercise.id);
      if (items.length === perDay) break;
    }

    if (items.length < perDay) {
      const covered = new Set(
        items.flatMap((i) => catalogById.get(i.exerciseId)?.primaryMuscles.slice(0, 1) ?? []),
      );
      const pool = catalog.filter((c) => !used.has(c.id) && c.primaryMuscles.some((m) => focus.has(m)));
      while (items.length < perDay) {
        // Re-ranked per pick, so two fill-ups don't hit the same muscle while another is missing.
        let best: CatalogRow | null = null;
        let bestScore = -1;
        for (const c of pool) {
          if (used.has(c.id)) continue;
          const score = (covered.has(c.primaryMuscles[0]) ? 0 : 10_000) + scoreExercise(c, loggedCounts.get(c.id) ?? 0);
          if (score > bestScore) {
            best = c;
            bestScore = score;
          }
        }
        if (!best) break;
        const c = best;
        items.push({
          day: day.label,
          exerciseId: c.id,
          targetSets: defaults.sets,
          repRangeMin: defaults.repMin,
          repRangeMax: defaults.repMax,
          targetRir: defaults.rir,
          restSeconds: defaults.restSeconds,
          notes: null,
          alternativeExerciseId: null,
          filledByServer: true,
        });
        used.add(c.id);
        covered.add(c.primaryMuscles[0]);
      }
    }
    result.push(...items);
  }
  return result;
}

// --- Start weight --------------------------------------------------------------------------

export interface LoggedSet {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

// Best estimated one-rep max (Epley) per exercise, then the weight that leaves `rir` reps in the
// tank at the top of the rep range — rounded down to 2.5 kg. Only for exercises with logged
// weighted sets; everything else gets no suggestion rather than a guess.
export function suggestStartWeights(
  sets: LoggedSet[],
  targets: { exerciseId: string; reps: number; rir: number }[],
): Map<string, number> {
  const bestE1rm = new Map<string, number>();
  for (const s of sets) {
    if (s.weightKg <= 0 || s.reps <= 0 || s.reps > 30) continue;
    const e1rm = s.weightKg * (1 + s.reps / 30);
    if (e1rm > (bestE1rm.get(s.exerciseId) ?? 0)) bestE1rm.set(s.exerciseId, e1rm);
  }
  const result = new Map<string, number>();
  for (const t of targets) {
    const e1rm = bestE1rm.get(t.exerciseId);
    if (!e1rm) continue;
    const weight = Math.floor(e1rm / (1 + (t.reps + t.rir) / 30) / 2.5) * 2.5;
    if (weight > 0) result.set(t.exerciseId, weight);
  }
  return result;
}
