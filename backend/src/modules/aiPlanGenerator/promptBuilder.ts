import type { PrismaClient, TrainingPhase } from "@prisma/client";

export interface ColdStartInput {
  frequencyPerWeek: number;
  equipment: "homegym" | "dumbbells" | "fullgym";
  experience: "beginner" | "intermediate" | "advanced";
  limitations?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
}

// Set/rep/RIR guidance per rotation phase, straight from the roadmap — keeps the model's
// suggestions consistent with what the 8-week rotation (trainingPlan.service.ts) actually means
// by each phase, instead of it guessing generic "3x10" for everything.
const PHASE_GUIDANCE: Record<TrainingPhase, string> = {
  AUFBAU: "Hypertrophie-Fokus: 3-4 Sätze, 8-12 Wiederholungen, RIR 1-2 (nah am Muskelversagen).",
  MUSKELAUSDAUER:
    "Kraftausdauer & Laktattoleranz: 3 Sätze, 15-25 Wiederholungen, kurze Satzpausen (30-60s).",
  NEGATIV:
    "Exzentrische Überlastung & Maximalkraft: 4-5 Sätze, 4-6 Wiederholungen, 3-4 Sekunden " +
    "langsame Negativbewegung pro Wiederholung.",
};

// Per split day, not a total — a 3-day Push/Pull/Legs plan gets 18 exercises (6 per day), not 6
// for the whole week. Matches how a real training split actually reads.
const EXERCISES_PER_DAY = 6;
const MAX_CATALOG_ENTRIES = 150;

// Same day-naming as `frontend/src/data/recommendedSplits.ts`'s RECOMMENDED_SPLITS, so a
// generated plan reads consistently with the app's own curated split templates. Repeated day
// types within a week (e.g. two Push days) get an A/B suffix so they're distinct `dayLabel`s —
// PlanExercise's unique index is (userId, phase, exerciseId, dayLabel), so two same-named days
// would otherwise collide if the same exercise got picked for both.
const SPLIT_TEMPLATES: Record<number, string[]> = {
  1: ["Ganzkörper"],
  2: ["Oberkörper", "Unterkörper"],
  3: ["Push (Brust, Schultern, Trizeps)", "Pull (Rücken, Bizeps)", "Legs (Beine)"],
  4: ["Oberkörper A", "Unterkörper A", "Oberkörper B", "Unterkörper B"],
  5: ["Brust", "Rücken", "Beine", "Schultern", "Arme"],
  6: [
    "Push A (Brust, Schultern, Trizeps)",
    "Pull A (Rücken, Bizeps)",
    "Beine A",
    "Push B (Brust, Schultern, Trizeps)",
    "Pull B (Rücken, Bizeps)",
    "Beine B",
  ],
};

// Resolves a weekly training frequency to a concrete split — the actual fix for "3x/week
// generated one full-body day of 6 exercises instead of a 3-day Push/Pull/Legs split": the
// frequency answer from the cold-start modal was collected but never used to shape the plan
// structure, only mentioned as a line of prompt context the model was free to ignore.
export function resolveSplitDays(frequencyPerWeek: number): string[] {
  const clamped = Math.min(6, Math.max(1, Math.round(frequencyPerWeek)));
  return SPLIT_TEMPLATES[clamped];
}

const RECENT_FREQUENCY_WINDOW_MS = 28 * 24 * 60 * 60 * 1000; // 4 weeks
const DEFAULT_WARM_START_FREQUENCY = 3;

// Warm-start users were never asked "how often do you train" (that's cold-start-only), so the
// split structure is instead derived from how often they actually log — distinct calendar days
// with at least one set over the last 4 weeks, averaged per week.
export async function estimateWeeklyFrequency(prisma: PrismaClient, userId: string): Promise<number> {
  const logs = await prisma.workoutLog.findMany({
    where: {
      userId,
      deletedAt: null,
      performedAt: { gte: new Date(Date.now() - RECENT_FREQUENCY_WINDOW_MS) },
    },
    select: { performedAt: true },
  });
  const distinctDays = new Set(logs.map((l) => l.performedAt.toISOString().slice(0, 10)));
  if (distinctDays.size === 0) return DEFAULT_WARM_START_FREQUENCY;
  return Math.min(6, Math.max(1, Math.round(distinctDays.size / 4)));
}
// Roadmap's exercise categories the generator is allowed to draw from — same "real, trainable
// movements" set the daily-challenge/plan-exercise features already scope themselves to.
const GENERATOR_CATEGORIES = ["strength", "plyometrics", "olympic weightlifting", "strongman"];

const EQUIPMENT_TAGS_BY_CHOICE: Record<ColdStartInput["equipment"], string[]> = {
  homegym: ["body only", "dumbbell", "bands", "kettlebells"],
  dumbbells: ["dumbbell", "body only"],
  // Empty = no equipment filter at all; a full gym has everything.
  fullgym: [],
};

function toCatalogEntry(ex: {
  id: string;
  name: string;
  nameDe: string | null;
  equipment: string | null;
  primaryMuscles: string[];
}): CatalogEntry {
  return { id: ex.id, name: ex.nameDe ?? ex.name, equipment: ex.equipment, primaryMuscles: ex.primaryMuscles };
}

const CATALOG_SELECT = {
  id: true,
  name: true,
  nameDe: true,
  equipment: true,
  primaryMuscles: true,
} as const;

// Caps and biases the exercise list injected into the prompt (never the full 870+ catalog —
// that would be an unreasonable token cost for every generation). Cold start filters by the
// equipment the user actually said they have; warm start biases toward exercises the user has
// actually trained before (relevant, less likely to be unfamiliar), backfilled with general
// strength/plyometric movements up to the cap so there's still enough variety for a full plan.
export async function selectCatalogSubset(
  prisma: PrismaClient,
  userId: string,
  coldStart: ColdStartInput | null,
): Promise<CatalogEntry[]> {
  if (coldStart) {
    const equipmentTags = EQUIPMENT_TAGS_BY_CHOICE[coldStart.equipment];
    const exercises = await prisma.exercise.findMany({
      where: {
        category: { in: GENERATOR_CATEGORIES },
        ...(equipmentTags.length > 0 ? { equipment: { in: equipmentTags } } : {}),
      },
      select: CATALOG_SELECT,
      take: MAX_CATALOG_ENTRIES,
    });
    return exercises.map(toCatalogEntry);
  }

  const logged = await prisma.workoutLog.groupBy({
    by: ["exerciseId"],
    where: { userId, deletedAt: null },
    _count: { _all: true },
  });
  const loggedIds = logged
    .sort((a, b) => b._count._all - a._count._all)
    .map((l) => l.exerciseId);

  const loggedExercises = await prisma.exercise.findMany({
    where: { id: { in: loggedIds } },
    select: CATALOG_SELECT,
  });
  // Preserve the frequency-descending order from `loggedIds` — `findMany({ where: { in } })`
  // doesn't guarantee result order matches the id list.
  const loggedById = new Map(loggedExercises.map((e) => [e.id, e]));
  const orderedLogged = loggedIds.map((id) => loggedById.get(id)).filter((e) => e !== undefined);

  const remaining = MAX_CATALOG_ENTRIES - orderedLogged.length;
  const fillerExercises =
    remaining > 0
      ? await prisma.exercise.findMany({
          where: { id: { notIn: loggedIds }, category: { in: GENERATOR_CATEGORIES } },
          select: CATALOG_SELECT,
          take: remaining,
        })
      : [];

  return [...orderedLogged, ...fillerExercises].map(toCatalogEntry);
}

const EIGHT_WEEKS_MS = 8 * 7 * 24 * 60 * 60 * 1000;

// Injects the user's nutrition profile (goal/weight/height/age) and best lifts from the last 8
// weeks as context — an existing user's plan should build on what they can already do, not
// start from a blank slate.
export async function buildWarmStartContext(prisma: PrismaClient, userId: string): Promise<string> {
  const [profile, recentLogs] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.workoutLog.groupBy({
      by: ["exerciseId"],
      where: { userId, deletedAt: null, performedAt: { gte: new Date(Date.now() - EIGHT_WEEKS_MS) } },
      _max: { weightKg: true, reps: true },
    }),
  ]);

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: recentLogs.map((l) => l.exerciseId) } },
    select: { id: true, name: true, nameDe: true },
  });
  const nameById = new Map(exercises.map((e) => [e.id, e.nameDe ?? e.name]));

  const bestLifts = recentLogs
    .map((l) => `${nameById.get(l.exerciseId) ?? "?"}: ${Number(l._max.weightKg)}kg x ${l._max.reps}`)
    .join(", ");

  const profileLine = profile
    ? `Ziel: ${profile.goal}, Körpergewicht: ${profile.weightKg}kg, Größe: ${profile.heightCm}cm, ` +
      `Alter: ${profile.age}, Aktivitätslevel: ${profile.activityLevel}.`
    : "Kein Ernährungsprofil hinterlegt.";

  return (
    `Bestehender Nutzer mit Trainingshistorie. ${profileLine}\n` +
    `Bestleistungen der letzten 8 Wochen: ${bestLifts || "keine in diesem Zeitraum"}.`
  );
}

const EQUIPMENT_LABELS: Record<ColdStartInput["equipment"], string> = {
  homegym: "Homegym (Kurzhanteln, Bänder, eigenes Körpergewicht)",
  dumbbells: "Nur Kurzhanteln",
  fullgym: "Vollausgestattetes Fitnessstudio",
};
const EXPERIENCE_LABELS: Record<ColdStartInput["experience"], string> = {
  beginner: "Anfänger",
  intermediate: "Fortgeschritten",
  advanced: "Erfahren",
};

// Cold-start context from the 4-step frontend modal, for a user without enough history for
// buildWarmStartContext to say anything useful.
export function buildColdStartContext(input: ColdStartInput): string {
  return (
    `Neuer Nutzer ohne (ausreichende) Trainingshistorie. ` +
    `Trainingsfrequenz: ${input.frequencyPerWeek}x/Woche. ` +
    `Verfügbares Equipment: ${EQUIPMENT_LABELS[input.equipment]}. ` +
    `Erfahrungsgrad: ${EXPERIENCE_LABELS[input.experience]}. ` +
    `Körperliche Einschränkungen: ${input.limitations?.trim() || "keine angegeben"}.`
  );
}

export function buildSystemPrompt(phase: TrainingPhase, catalog: CatalogEntry[], splitDays: string[]): string {
  const catalogLines = catalog
    .map((c) => `${c.id} | ${c.name} | ${c.equipment ?? "-"} | ${c.primaryMuscles.join(",") || "-"}`)
    .join("\n");
  const dayList = splitDays.map((d) => `"${d}"`).join(", ");
  const totalExercises = splitDays.length * EXERCISES_PER_DAY;

  const splitInstruction =
    splitDays.length === 1
      ? `Es wird an einem Tag pro Trainingszyklus trainiert ("${splitDays[0]}") — wähle Übungen für den ganzen Körper.`
      : `Es wird an ${splitDays.length} verschiedenen Tagen pro Trainingszyklus trainiert. Jeder Tag hat einen eigenen Fokus, erkennbar am Namen: ${dayList}. Wähle für jeden Tag Übungen, die zu genau diesem Fokus passen (z. B. bei einem "Push"-Tag nur drückende Bewegungen für Brust/Schultern/Trizeps, bei "Beine" nur Bein-Übungen) — kein Tag darf Übungen eines anderen Tages enthalten.`;

  return `Du bist ein erfahrener Fitness-Trainer-Assistent, der einen Trainingsplan für die Phase "${phase}" erstellt.

Phasen-Vorgabe: ${PHASE_GUIDANCE[phase]}

Trainingsplan-Struktur: ${splitInstruction}

WICHTIG — Übungsauswahl: Wähle AUSSCHLIESSLICH Übungen aus der folgenden Liste (Format: ID | Name | Equipment | Muskelgruppen). Verwende niemals eine ID, die nicht in dieser Liste steht, und erfinde keine neuen Übungen — nur die exakten IDs aus der Liste sind gültig.

${catalogLines}

Antworte AUSSCHLIESSLICH mit validem JSON in exakt diesem Format, ohne Freitext davor oder danach:
{"items": [{"day": "<einer der Tage: ${dayList}>", "exerciseId": "<ID aus der Liste oben>", "targetSets": <Zahl>, "targetReps": <Zahl>, "order": <Zahl ab 0, neu beginnend pro Tag>}]}

Wähle für JEDEN der ${splitDays.length} Tage genau ${EXERCISES_PER_DAY} passende Übungen für dessen Fokus (insgesamt genau ${totalExercises} Einträge), mit targetSets/targetReps passend zur Phasen-Vorgabe oben. Das Feld "day" muss exakt einem der oben genannten Tagesnamen entsprechen.`;
}
