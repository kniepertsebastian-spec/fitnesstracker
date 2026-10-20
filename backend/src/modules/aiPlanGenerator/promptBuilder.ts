import type { PrismaClient, TrainingPhase } from "@prisma/client";
import type { ColdStartInput, EquipmentTag, SplitPreference } from "@fitnesstracker/shared";
import { isExcluded, type ExerciseExclusions } from "./injuryFilter.js";
import { equipmentTagOf, selectBalancedCatalog, type PhaseDefaults, type SplitDay } from "./planAssembly.js";

export type { ColdStartInput };

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

// Fallback values when the model omits a field or an exercise is filled in server-side —
// the same ranges PHASE_GUIDANCE asks for.
export const PHASE_DEFAULTS: Record<TrainingPhase, PhaseDefaults> = {
  AUFBAU: { sets: 3, repMin: 8, repMax: 12, rir: 2, restSeconds: 120 },
  MUSKELAUSDAUER: { sets: 3, repMin: 15, repMax: 20, rir: 2, restSeconds: 60 },
  NEGATIV: { sets: 4, repMin: 4, repMax: 6, rir: 2, restSeconds: 180 },
};

// Per split day, not a total — a 3-day Push/Pull/Legs plan gets 18 exercises (6 per day), not 6
// for the whole week. Matches how a real training split actually reads.
const EXERCISES_PER_DAY = 6;

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
const GENERATOR_CATEGORIES = ["strength", "powerlifting", "plyometrics", "olympic weightlifting", "strongman"];

function toCatalogEntry(ex: {
  id: string;
  name: string;
  nameDe: string | null;
  equipment: string | null;
  primaryMuscles: string[];
}): CatalogEntry {
  return { id: ex.id, name: ex.nameDe ?? ex.name, equipment: ex.equipment, primaryMuscles: ex.primaryMuscles };
}

export interface CatalogSelection {
  // What the prompt shows (German name where known).
  entries: CatalogEntry[];
  // Raw rows (English name for the staple ranking), for assembleDays.
  rows: { id: string; name: string; nameDe: string | null; equipment: string | null; primaryMuscles: string[] }[];
  loggedCounts: Map<string, number>;
}

// The exercise list injected into the prompt (never the full 870+ catalog — that would be an
// unreasonable token cost for every generation): only allowed equipment, nothing an injury rules
// out, and an even share per muscle the split trains — see selectBalancedCatalog.
export async function selectCatalog(
  prisma: PrismaClient,
  userId: string,
  equipment: EquipmentTag[],
  days: SplitDay[],
  exclusions: ExerciseExclusions = { muscles: [], nameKeywords: [] },
  // Plateaued exercises: kept out of the catalog so the model has to pick variants instead.
  excludedIds: ReadonlySet<string> = new Set(),
): Promise<CatalogSelection> {
  const allowedTags = new Set(equipment);
  const [rows, logged] = await Promise.all([
    prisma.exercise.findMany({
      where: { category: { in: GENERATOR_CATEGORIES }, isActive: true },
      select: { id: true, name: true, nameDe: true, equipment: true, primaryMuscles: true, category: true },
    }),
    prisma.workoutLog.groupBy({
      by: ["exerciseId"],
      where: { userId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  const loggedCounts = new Map(logged.map((l) => [l.exerciseId, l._count._all]));
  const usable = rows.filter(
    (row) => allowedTags.has(equipmentTagOf(row.equipment)) && !isExcluded(row, exclusions) && !excludedIds.has(row.id),
  );
  const muscles = [...new Set(days.flatMap((d) => d.muscles))];
  const picked = selectBalancedCatalog(usable, muscles, loggedCounts, userId);
  return { entries: picked.map(toCatalogEntry), rows: picked, loggedCounts };
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

export async function buildPlanRemarksContext(prisma: PrismaClient, userId: string): Promise<string> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { userId },
    select: { remarks: true, detectedAsymmetries: true },
  });
  if (!plan) return "";
  const lines = [
    plan.remarks?.trim() ? `Bemerkungen des Nutzers: ${plan.remarks.trim()}` : null,
    ...plan.detectedAsymmetries.map((remark) => `Automatisch erkannte Trainingsasymmetrie: ${remark}`),
  ].filter((line): line is string => line !== null);
  return lines.length > 0
    ? `\nDiese Hinweise müssen bei der Übungsauswahl und Trainingsverteilung berücksichtigt werden:\n${lines.join("\n")}`
    : "";
}

// Free text that can name an injury: the standing remarks on the plan (also the only place a
// warm-start user — who skips the cold-start questionnaire — can state one).
export async function loadLimitationTexts(
  prisma: PrismaClient,
  userId: string,
  coldStart: ColdStartInput | null,
): Promise<string[]> {
  const plan = await prisma.trainingPlan.findUnique({ where: { userId }, select: { remarks: true } });
  return [plan?.remarks, coldStart?.limitations, coldStart?.avoidedExercises].filter(
    (t): t is string => !!t,
  );
}

const EQUIPMENT_LABELS: Record<EquipmentTag, string> = {
  machine: "Geräte/Maschinen",
  dumbbell: "Kurzhanteln",
  barbell: "Langhantel/SZ-Stange",
  cable: "Kabelturm",
  "body only": "ohne Geräte (Körpergewicht)",
  kettlebells: "Kettlebells",
  bands: "Bänder",
  "medicine ball": "Medizinball",
  "exercise ball": "Gymnastikball",
  "foam roll": "Faszienrolle",
  other: "Sonstiges",
};
const SPLIT_LABELS: Record<SplitPreference, string> = {
  auto: "keine Vorgabe",
  full_body: "Ganzkörper",
  upper_lower: "Oberkörper/Unterkörper",
  push_pull_legs: "Push/Pull/Beine",
  bro_split: "Bro-Split (ein Muskel pro Tag)",
};
const EXPERIENCE_LABELS: Record<ColdStartInput["experience"], string> = {
  beginner: "Anfänger",
  intermediate: "Fortgeschritten",
  advanced: "Erfahren",
};
const GOAL_LABELS: Record<ColdStartInput["goal"], string> = {
  muscle_gain: "Muskelaufbau",
  strength: "Kraftaufbau",
  endurance: "Kraftausdauer",
  fat_loss: "Fettabbau bei Muskelerhalt",
  general_fitness: "allgemeine Fitness",
};

// Questionnaire answers as prompt context.
export function buildColdStartContext(input: ColdStartInput): string {
  return (
    `Aktuelle Angaben des Nutzers. ` +
    `Hauptziel: ${GOAL_LABELS[input.goal]}. ` +
    `Trainingsfrequenz: ${input.frequencyPerWeek}x/Woche. ` +
    `Gewünschter Split: ${SPLIT_LABELS[input.split]}. ` +
    `Verfügbare Zeit pro Einheit: ${input.sessionDurationMinutes} Minuten. ` +
    `Erlaubtes Equipment: ${input.equipment.map((t) => EQUIPMENT_LABELS[t]).join(", ")} (alles andere ist ausgeschlossen). ` +
    `Konkretes Equipment: ${input.equipmentDetails?.trim() || "keine weiteren Angaben"}. ` +
    `Erfahrungsgrad: ${EXPERIENCE_LABELS[input.experience]}. ` +
    `Priorisierte Muskelgruppen: ${input.priorityMuscles?.trim() || "keine"}. ` +
    `Bevorzugte Übungen: ${input.preferredExercises?.trim() || "keine angegeben"}. ` +
    `Zu vermeidende Übungen: ${input.avoidedExercises?.trim() || "keine angegeben"}. ` +
    `Körperliche Einschränkungen: ${input.limitations?.trim() || "keine angegeben"}.`
  );
}

export function exercisesPerDayForDuration(minutes?: number): number {
  if (!minutes) return EXERCISES_PER_DAY;
  if (minutes <= 30) return 3;
  if (minutes <= 45) return 4;
  if (minutes <= 60) return 5;
  if (minutes <= 90) return 6;
  return 7;
}

export function buildSystemPrompt(
  phase: TrainingPhase,
  catalog: CatalogEntry[],
  days: SplitDay[],
  exercisesPerDay = EXERCISES_PER_DAY,
): string {
  const catalogLines = catalog
    .map((c) => `${c.id} | ${c.name} | ${c.equipment ?? "-"} | ${c.primaryMuscles.join(",") || "-"}`)
    .join("\n");
  const dayLines = days.map((d) => `- "${d.label}": Muskeln ${d.muscles.join(", ")}`).join("\n");
  const totalExercises = days.length * exercisesPerDay;
  const defaults = PHASE_DEFAULTS[phase];

  return `Du bist ein erfahrener Fitness-Trainer-Assistent, der einen Trainingsplan für die Phase "${phase}" erstellt.

Phasen-Vorgabe: ${PHASE_GUIDANCE[phase]}

Passe Übungsauswahl, Satzanzahl und Komplexität an Hauptziel, Erfahrung und verfügbare Zeit an.
Bevorzugte Übungen sind Wünsche, zu vermeidende Übungen und gesundheitliche Einschränkungen sind
Ausschlusskriterien. Priorisierte Muskelgruppen dürfen mehr sinnvolles Volumen erhalten, ohne
automatisch erkannte Gegenspieler-Asymmetrien weiter zu verstärken. Beginne jeden Tag mit den
schweren Mehrgelenksübungen, danach Isolationsübungen.

Trainingstage (jeder Tag trainiert NUR die genannten Muskeln, gemessen an der ersten Muskelgruppe
einer Übung im Katalog):
${dayLines}

GESUNDHEIT UND EINSCHRÄNKUNGEN: Die vom Nutzer genannten körperlichen Einschränkungen sind harte
Ausschlusskriterien. Wähle keine Übung, die die betroffene Körperregion direkt oder indirekt stark
belastet (auch Sekundärbelastungen). Sicherheit hat Vorrang vor Vollständigkeit und Vielfalt.

WICHTIG — Übungsauswahl: Wähle AUSSCHLIESSLICH Übungen aus der folgenden Liste (Format: ID | Name |
Equipment | Muskelgruppen). Verwende niemals eine ID, die nicht in dieser Liste steht. Pro Tag keine
Übung doppelt.

${catalogLines}

Antworte AUSSCHLIESSLICH mit validem JSON in exakt diesem Format, ohne Freitext davor oder danach:
{"rationale": "<2-4 Sätze auf Deutsch: warum dieser Aufbau zu Ziel und Angaben passt>",
 "items": [{"day": "<exakter Tagesname>", "exerciseId": "<ID aus der Liste>", "targetSets": <Zahl>,
 "repRangeMin": <Zahl>, "repRangeMax": <Zahl>, "targetRir": <0-5>, "restSeconds": <Satzpause in Sekunden>,
 "cue": "<ein kurzer Technik-Hinweis auf Deutsch, max. 120 Zeichen>",
 "alternativeExerciseId": "<ID einer gleichwertigen Ersatzübung aus der Liste, gleiche Muskelgruppe, oder null>",
 "order": <Zahl ab 0, neu beginnend pro Tag>}]}

Wähle für JEDEN der ${days.length} Tage genau ${exercisesPerDay} Übungen (insgesamt ${totalExercises} Einträge).
Richtwerte dieser Phase: ${defaults.sets} Sätze, ${defaults.repMin}-${defaults.repMax} Wiederholungen,
RIR ${defaults.rir}, ${defaults.restSeconds} s Pause — Grundübungen eher längere, Isolationsübungen kürzere Pausen.`;
}
