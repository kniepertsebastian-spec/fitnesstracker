import { z } from "zod";

// Intensity techniques, set schemes and week-to-week periodization the AI plan generator may use, the
// manual plan editor offers, and the focus mode knows how to run. One catalog for all of them: the
// info texts shown next to each option, the rules the server enforces on the AI's choices, and the
// defaults the focus mode uses.

export const TECHNIQUES = [
  "SUPERSET",
  "DROPSET",
  "REST_PAUSE",
  "MYO_REPS",
  "CLUSTER",
  "COMPOUND_SET",
  "PRE_EXHAUST",
  "POST_EXHAUST",
  "GIANT_SET",
  "PARTIAL_REPS",
  "NEGATIVES",
  "ISOMETRIC",
  "TWENTY_ONES",
] as const;
export const techniqueSchema = z.enum(TECHNIQUES);
export type Technique = z.infer<typeof techniqueSchema>;

// group: several exercises done back to back (the plan marks them with a shared group key).
// segment: extra mini sets after the last working set of one exercise.
// cue: a different way of doing the reps, shown as an instruction.
export type TechniqueKind = "group" | "segment" | "cue";

// Where in a set scheme an exercise runs: all sets the same (default), a pyramid, or timed holds.
export const SET_SCHEMES = ["STRAIGHT", "PYRAMID", "TIME_BASED"] as const;
export const setSchemeSchema = z.enum(SET_SCHEMES);
export type SetScheme = z.infer<typeof setSchemeSchema>;

// How a phase changes from week to week (a property of the phase, not of one exercise).
export const PERIODIZATIONS = ["LINEAR", "WAVE"] as const;
export const periodizationSchema = z.enum(PERIODIZATIONS);
export type Periodization = z.infer<typeof periodizationSchema>;

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface TechniqueInfo {
  label: string;
  kind: TechniqueKind;
  // One line for the list.
  short: string;
  what: string;
  how: string;
  goodFor: string;
  avoid: string;
  // Honest note on the evidence or the risk.
  note: string;
}

export const TECHNIQUE_INFO: Record<Technique, TechniqueInfo> = {
  SUPERSET: {
    label: "Supersatz",
    kind: "group",
    short: "Zwei Übungen direkt hintereinander, meist für gegenüberliegende Muskeln",
    what: "Zwei Übungen werden ohne Pause abwechselnd gemacht, zum Beispiel Bizeps-Curl und Trizeps-Drücken. Erst nach der Runde gibt es eine Pause.",
    how: "Satz A, sofort Satz B, dann pausieren. Das wiederholst du für alle Sätze.",
    goodFor: "Zeit sparen und Training verdichten. Gegenspieler (Brust/Rücken, Bizeps/Trizeps, Beinstrecker/Beinbeuger) stören sich kaum, du kannst oft fast das gleiche Gewicht nehmen.",
    avoid: "Zwei schwere Grundübungen mit hoher Last: die Technik leidet, wenn du außer Atem bist.",
    note: "Spart Zeit bei vergleichbarem Muskelaufbau. Kein Muss, wenn du ohnehin genug Zeit hast.",
  },
  DROPSET: {
    label: "Dropsatz",
    kind: "segment",
    short: "Nach dem Satz Gewicht senken und sofort weitermachen",
    what: "Du trainierst einen Satz bis kurz vor dem Versagen, senkst das Gewicht um etwa 20 % und machst ohne Pause weiter, ein- oder zweimal.",
    how: "Hauptsatz, Gewicht reduzieren (Stift am Gerät umstecken, kleinere Hantel), kurze Pause von rund 10–15 Sekunden, nächste Stufe.",
    goodFor: "Letzter Satz einer Isolations- oder Maschinenübung, wenn der Muskel noch mehr Reiz bekommen soll.",
    avoid: "Schwere Grundübungen mit Langhantel (Kniebeuge, Kreuzheben, Bankdrücken ohne Spotter) und die Anfangsübung eines Tages.",
    note: "Viel Ermüdung für wenig zusätzlichen Zuwachs: sparsam einsetzen, nicht in jeder Einheit.",
  },
  REST_PAUSE: {
    label: "Rest-Pause-Satz",
    kind: "segment",
    short: "Satz bis nahe ans Versagen, kurze Pause, noch ein paar Wiederholungen",
    what: "Nach einem harten Satz folgt eine sehr kurze Pause von etwa 15–20 Sekunden, dann machst du mit dem gleichen Gewicht noch einmal so viele Wiederholungen wie möglich, ein- oder zweimal.",
    how: "Hauptsatz bis nahe ans Versagen, 15–20 s Pause, Mini-Satz, wieder 15–20 s Pause, zweiter Mini-Satz.",
    goodFor: "Letzter Satz einer Maschinen- oder Kabelübung, wenn die Zeit knapp ist.",
    avoid: "Übungen mit hoher technischer Anforderung oder Verletzungsrisiko bei Ermüdung.",
    note: "Zeiteffizient, aber sehr fordernd. Sparsam und nur im letzten Satz.",
  },
  MYO_REPS: {
    label: "Myo-Reps",
    kind: "segment",
    short: "Ein Aktivierungssatz, danach mehrere Mini-Sätze mit kurzer Pause",
    what: "Ein Satz mit 12–20 Wiederholungen bis nahe ans Versagen, danach vier bis fünf Mini-Sätze mit je 3–5 Wiederholungen und etwa 10–15 Sekunden Pause.",
    how: "Aktivierungssatz, 10–15 s Pause (ein paar Atemzüge), 3–5 Wiederholungen, wieder Pause, so lange du die Wiederholungszahl halten kannst.",
    goodFor: "Isolationsübungen, wenn du in wenig Zeit viel hartes Volumen sammeln willst.",
    avoid: "Schwere Grundübungen und Anfängerphasen.",
    note: "Beliebt, die Studienlage gegenüber normalen Sätzen ist dünn. Sparsam probieren.",
  },
  CLUSTER: {
    label: "Clustersatz",
    kind: "cue",
    short: "Ein Satz in kleine Teile mit kurzen Pausen dazwischen",
    what: "Ein schwerer Satz wird in kleine Gruppen aus zwei bis drei Wiederholungen geteilt, dazwischen liegen 15–30 Sekunden Pause.",
    how: "Zum Beispiel 2 + 2 + 2 Wiederholungen mit 20 s Pause dazwischen, immer mit dem gleichen, schweren Gewicht.",
    goodFor: "Schwere Grundübungen in der Kraftphase: mehr Wiederholungen bei hoher Last und sauberer Technik.",
    avoid: "Leichte Isolationsübungen und Ausdauerphasen.",
    note: "Sinnvoll vor allem im Krafttraining. Die Pause zwischen den Teilen stoppst du mit der Mini-Pause.",
  },
  COMPOUND_SET: {
    label: "Verbundsatz",
    kind: "group",
    short: "Zwei Übungen für denselben Muskel direkt hintereinander",
    what: "Zwei Übungen für dieselbe Muskelgruppe werden ohne Pause nacheinander gemacht, zum Beispiel Bankdrücken und danach Fliegende.",
    how: "Übung A, sofort Übung B, dann Pause. Das Gewicht der zweiten Übung fällt meist niedriger aus.",
    goodFor: "Mehr Reiz auf einen Muskel in kurzer Zeit, wenn die Grundübungen schon erledigt sind.",
    avoid: "Wenn ein Muskel ohnehin schon viel Volumen bekommt oder du verletzt bist.",
    note: "Viel lokale Ermüdung. Nicht mit Gelenkproblemen kombinieren.",
  },
  PRE_EXHAUST: {
    label: "Vorermüdung",
    kind: "group",
    short: "Erst eine Isolationsübung, dann die Grundübung für denselben Muskel",
    what: "Du ermüdest einen Muskel zuerst mit einer Isolationsübung und machst direkt danach die Grundübung, zum Beispiel Fliegende vor dem Bankdrücken.",
    how: "Isolationsübung bis nahe ans Versagen, sofort die Grundübung mit etwas weniger Gewicht als sonst.",
    goodFor: "Wenn ein schwacher Hilfsmuskel (zum Beispiel der Trizeps) die Grundübung begrenzt und der Zielmuskel mehr arbeiten soll.",
    avoid: "Wenn du Maximalkraft in der Grundübung trainieren willst: das Gewicht muss gesenkt werden.",
    note: "Der Nutzen gegenüber normaler Reihenfolge ist unsicher. Gut zum Ausprobieren.",
  },
  POST_EXHAUST: {
    label: "Nachermüdung",
    kind: "group",
    short: "Erst die Grundübung, dann direkt eine Isolationsübung für denselben Muskel",
    what: "Nach der Grundübung folgt sofort eine Isolationsübung für denselben Muskel, zum Beispiel Bankdrücken und danach Fliegende.",
    how: "Grundübung mit voller Last, dann ohne Pause die Isolationsübung bis nahe ans Versagen.",
    goodFor: "Den Zielmuskel nach den schweren Sätzen gezielt auslasten.",
    avoid: "Bei Schulter- oder Ellenbogenproblemen, die durch die Isolationsübung gereizt werden.",
    note: "Ähnlich wie ein Verbundsatz, nur mit festgelegter Reihenfolge.",
  },
  GIANT_SET: {
    label: "Riesensatz",
    kind: "group",
    short: "Drei oder vier Übungen für einen Muskel hintereinander",
    what: "Drei oder mehr Übungen für dieselbe Muskelgruppe werden ohne Pause nacheinander gemacht.",
    how: "Übung 1, 2, 3 (4) direkt hintereinander, danach eine längere Pause. Gewichte moderat wählen.",
    goodFor: "Ein bis zwei Mal pro Phase als intensiver Abschluss eines Tages.",
    avoid: "Anfänger, Kraftphasen und alle Tage, an denen du noch Grundübungen vor dir hast.",
    note: "Sehr fordernd und zeitintensiv in der Erholung. Nur selten sinnvoll.",
  },
  PARTIAL_REPS: {
    label: "Teilwiederholungen",
    kind: "cue",
    short: "Am Ende des Satzes im stärksten Teil der Bewegung weitermachen",
    what: "Wenn du die volle Bewegung nicht mehr schaffst, machst du im Bereich weiter, in dem du noch kräftig bist (meist im oberen Teil).",
    how: "Volle Wiederholungen bis nahe ans Versagen, danach 3–6 kurze Teilwiederholungen.",
    goodFor: "Ende eines Satzes an Maschinen oder Kabel, wenn das Gelenk stabil geführt wird.",
    avoid: "Schwere freie Grundübungen und alle Übungen, bei denen Schwung die Bewegung führt.",
    note: "Kann als Ergänzung helfen, ersetzt aber nicht den vollen Bewegungsumfang. Zählt nicht für Rekorde.",
  },
  NEGATIVES: {
    label: "Negativwiederholungen",
    kind: "cue",
    short: "Das Gewicht langsam ablassen, 3–5 Sekunden",
    what: "Die Absenkphase der Bewegung wird bewusst langsam ausgeführt, drei bis fünf Sekunden.",
    how: "Heben wie gewohnt, ablassen in 3–5 Sekunden. Eine Wiederholung mehr zählst du nur, wenn die Technik sauber bleibt.",
    goodFor: "Kraftphasen und Muskelaufbau: der Muskel wird beim Bremsen stark belastet.",
    avoid: "Bei starker Vorermüdung, in Deload-Wochen und wenn kein Spotter oder keine sichere Ablage da ist.",
    note: "Erzeugt oft mehr Muskelkater. Anfänger steigern vorsichtig.",
  },
  ISOMETRIC: {
    label: "Isometrisch (Halten)",
    kind: "cue",
    short: "Eine Position gegen den Widerstand halten",
    what: "Du hältst die Bewegung an einer Stelle an (zum Beispiel unten oder in der Mitte) und drückst oder ziehst dort gegen die Last.",
    how: "An der schwersten Stelle 2–5 Sekunden pausieren, danach weiter. Oder die Position als Satz halten, siehe zeitbasierte Sätze.",
    goodFor: "Schwachstellen in der Bewegung, Core-Training, Gelenkstabilität.",
    avoid: "Bluthochdruck ohne ärztliche Freigabe und alles, was dich zum Pressen mit angehaltenem Atem bringt.",
    note: "Atmen nicht vergessen. Bei Herz-Kreislauf-Problemen vorher abklären.",
  },
  TWENTY_ONES: {
    label: "21er-Sätze",
    kind: "cue",
    short: "7 untere, 7 obere und 7 volle Wiederholungen ohne Pause",
    what: "Ein Satz besteht aus drei Teilen: sieben Wiederholungen in der unteren Hälfte der Bewegung, sieben in der oberen Hälfte, sieben volle.",
    how: "Typisch bei Bizeps-Curls: zuerst 7 von unten bis zur Mitte, 7 von der Mitte nach oben, 7 volle. Gewicht deutlich leichter wählen.",
    goodFor: "Ein Abschlusssatz für kleine Muskeln wie Bizeps, Trizeps oder Waden.",
    avoid: "Schwere Grundübungen. Maximal ein bis zwei Übungen pro Einheit.",
    note: "Mehr Show als bewiesene Wirkung; er ist anstrengend und zählt nicht für Rekorde.",
  },
};

export interface SchemeInfo {
  label: string;
  short: string;
  what: string;
  how: string;
  goodFor: string;
  avoid: string;
}

export const SET_SCHEME_INFO: Record<Exclude<SetScheme, "STRAIGHT">, SchemeInfo> = {
  PYRAMID: {
    label: "Pyramidentraining",
    short: "Gewicht steigt von Satz zu Satz, die Wiederholungen sinken",
    what: "Du beginnst mit einem leichteren Gewicht und vielen Wiederholungen und steigerst von Satz zu Satz das Gewicht, während die Wiederholungen sinken (zum Beispiel 12, 10, 8, 6).",
    how: "Die App zeigt dir pro Satz Wiederholungen und Gewicht in Prozent des schwersten Satzes. Der erste Satz dient gleichzeitig als Aufwärmen.",
    goodFor: "Grundübungen, bei denen du Aufwärmen und Arbeitssätze verbinden willst, und für Abwechslung bei Muskelaufbau und Kraft.",
    avoid: "Ausdauerphasen und Isolationsübungen, bei denen ein gleichbleibendes Gewicht reicht.",
  },
  TIME_BASED: {
    label: "Zeitbasierte Sätze",
    short: "Statt Wiederholungen eine Zeit halten oder arbeiten",
    what: "Ein Satz wird nach Sekunden statt nach Wiederholungen gemessen, zum Beispiel Plank 45 Sekunden oder Wandsitzen 40 Sekunden.",
    how: "Die App zeigt die Zielzeit und einen Timer. Du trägst die tatsächliche Zeit ein, sie zählt nicht als Gewichtsrekord.",
    goodFor: "Halteübungen und Core: Plank, Wandsitzen, Hängen.",
    avoid: "Bewegungen mit Gewicht, bei denen die Wiederholungszahl wichtig ist.",
  },
};

export interface PeriodizationInfo {
  label: string;
  short: string;
  what: string;
  how: string;
}

export const PERIODIZATION_INFO: Record<Periodization, PeriodizationInfo> = {
  LINEAR: {
    label: "Lineare Steigerung über die Wochen",
    short: "Mit der Zeit weniger Wiederholungen, dafür schwerer",
    what: "Über die Wochen einer Phase werden die Wiederholungen schrittweise weniger und die Last schwerer: Start eher leicht mit mehr Wiederholungen, am Ende schwer mit weniger.",
    how: "Die App passt Wiederholungsziel und RIR je Woche der Phase an und zeigt die Woche im Training.",
  },
  WAVE: {
    label: "Wellenförmig über die Wochen",
    short: "Schwere, mittlere und leichte Wochen im Wechsel",
    what: "Die Belastung schwankt in einer Dreier-Welle: mittel, schwer, leicht. Die leichte Woche entlastet, bevor die nächste Welle höher ansetzt.",
    how: "Die App verschiebt Wiederholungsziel und RIR je Woche der Phase und zeigt, in welchem Teil der Welle du bist.",
  },
};

// ---- Rules the server enforces on what the AI proposes ------------------------------------------

const LEVEL_RANK: Record<ExperienceLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

// Lowest experience a technique is offered for.
export const TECHNIQUE_MIN_LEVEL: Record<Technique, ExperienceLevel> = {
  SUPERSET: "beginner",
  COMPOUND_SET: "beginner",
  NEGATIVES: "beginner",
  ISOMETRIC: "beginner",
  DROPSET: "intermediate",
  PARTIAL_REPS: "intermediate",
  PRE_EXHAUST: "intermediate",
  POST_EXHAUST: "intermediate",
  REST_PAUSE: "advanced",
  MYO_REPS: "advanced",
  CLUSTER: "advanced",
  GIANT_SET: "advanced",
  TWENTY_ONES: "intermediate",
};

export function techniqueAllowedFor(technique: Technique, level: ExperienceLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[TECHNIQUE_MIN_LEVEL[technique]];
}

// How many exercises a group technique spans.
export const GROUP_SIZE: Partial<Record<Technique, { min: number; max: number }>> = {
  SUPERSET: { min: 2, max: 2 },
  COMPOUND_SET: { min: 2, max: 2 },
  PRE_EXHAUST: { min: 2, max: 2 },
  POST_EXHAUST: { min: 2, max: 2 },
  GIANT_SET: { min: 3, max: 4 },
};

// Techniques per training day: sparing on purpose — a plan full of them wears the user out. A group
// counts once, whatever its size.
export function maxTechniquesPerDay(exercisesPerDay: number, level: ExperienceLevel): number {
  if (level === "beginner") return 1;
  return Math.max(1, Math.min(3, Math.ceil(exercisesPerDay / 3)));
}

// What the focus mode does after the last working set of an exercise with a segment technique.
export interface SegmentPlan {
  // Extra mini sets after the working set.
  extraSets: number;
  // Pause between them, seconds (the drop set pause is a user setting and overrides this one).
  restSeconds: number;
  // Weight of the extra sets relative to the last one.
  weightFactor: number;
  label: string;
}

export const SEGMENT_PLANS: Partial<Record<Technique, SegmentPlan>> = {
  DROPSET: { extraSets: 2, restSeconds: 15, weightFactor: 0.8, label: "Dropsatz" },
  REST_PAUSE: { extraSets: 2, restSeconds: 20, weightFactor: 1, label: "Rest-Pause" },
  MYO_REPS: { extraSets: 4, restSeconds: 12, weightFactor: 1, label: "Myo-Reps" },
};

// ---- Set schemes ------------------------------------------------------------------------------

// One set of a per-set prescription. Weight is a share of the heaviest set so it works for any load.
export const setPlanEntrySchema = z.object({
  reps: z.number().int().min(1).max(100).optional(),
  seconds: z.number().int().min(5).max(600).optional(),
  weightPct: z.number().int().min(20).max(120).optional(),
});
export type SetPlanEntry = z.infer<typeof setPlanEntrySchema>;
export const setPlanSchema = z.array(setPlanEntrySchema).min(1).max(12);

// The per-set prescription for a scheme, derived from the plan's own sets and rep range so the AI
// never has to invent numbers: a pyramid climbs from the top of the range down to the bottom.
export function buildSetPlan(
  scheme: SetScheme | null | undefined,
  sets: number,
  repMin: number,
  repMax: number,
): SetPlanEntry[] | null {
  if (!scheme || scheme === "STRAIGHT" || sets < 1) return null;
  if (scheme === "TIME_BASED") {
    // Hold time: the rep range read as seconds would be tiny, so it is the base in 5 s steps, at least 20.
    const base = Math.max(20, Math.round(((repMin + repMax) / 2) * 3 / 5) * 5);
    return Array.from({ length: sets }, () => ({ seconds: Math.min(600, base) }));
  }
  // PYRAMID: n sets from the top of the rep range (lightest) down to the bottom (heaviest).
  const n = Math.min(sets, 6);
  const low = Math.max(1, Math.min(repMin, repMax));
  const high = Math.max(low, repMax);
  const span = Math.max(1, n - 1);
  return Array.from({ length: n }, (_, i) => {
    const t = i / span;
    return {
      reps: Math.max(1, Math.round(high - (high - low) * t)),
      weightPct: Math.round(75 + 25 * t),
    };
  });
}

// ---- Periodization --------------------------------------------------------------------------

export interface WeekShift {
  // Added to the rep range (never below 1) and to the RIR (kept within 0-5).
  repsDelta: number;
  rirDelta: number;
  // Shown with the week, e.g. "schwere Woche".
  label: string;
}

// `week` is 1-based within a phase of `totalWeeks` weeks.
export function weekShift(kind: Periodization, week: number, totalWeeks: number): WeekShift {
  const w = Math.max(1, week);
  if (kind === "WAVE") {
    // A three-week wave: medium, heavy, light.
    const step = (w - 1) % 3;
    if (step === 1) return { repsDelta: -2, rirDelta: -1, label: "schwere Woche" };
    if (step === 2) return { repsDelta: 3, rirDelta: 1, label: "leichte Woche" };
    return { repsDelta: 0, rirDelta: 0, label: "mittlere Woche" };
  }
  // LINEAR: from +2 reps / +1 RIR at the start to −2 reps / −1 RIR in the last week.
  const total = Math.max(2, totalWeeks);
  const p = Math.min(1, (w - 1) / (total - 1));
  const repsDelta = Math.round(2 - 4 * p);
  const rirDelta = p < 0.34 ? 1 : p > 0.67 ? -1 : 0;
  return { repsDelta, rirDelta, label: p < 0.34 ? "Aufbauwochen" : p > 0.67 ? "schwere Wochen" : "mittlere Wochen" };
}

// Applies a week's shift to a prescription: the rep range, the rep target, each set of a per-set
// prescription, and the RIR. Fields that are null stay null (a manual entry without a range keeps none).
export function shiftPrescription<
  T extends { repRangeMin: number | null; repRangeMax: number | null; targetReps: number | null; targetRir: number | null; setPlan: SetPlanEntry[] | null },
>(p: T, shift: WeekShift): T {
  const reps = (n: number) => Math.max(1, n + shift.repsDelta);
  return {
    ...p,
    repRangeMin: p.repRangeMin === null ? null : reps(p.repRangeMin),
    repRangeMax: p.repRangeMax === null ? null : reps(p.repRangeMax),
    targetReps: p.targetReps === null ? null : reps(p.targetReps),
    targetRir: p.targetRir === null ? null : Math.min(5, Math.max(0, p.targetRir + shift.rirDelta)),
    // Timed sets are not rep based: they keep their seconds.
    setPlan: p.setPlan === null ? null : p.setPlan.map((s) => (s.reps === undefined ? s : { ...s, reps: reps(s.reps) })),
  };
}

// The questionnaire's two lists. `techniques`: what the user is open to (empty = classic sets only);
// `schemes` / `periodizations`: what the AI may choose on its own.
export const planStyleChoicesSchema = z.object({
  techniques: z.array(techniqueSchema).max(TECHNIQUES.length).default([]),
  schemes: z.array(z.enum(["PYRAMID", "TIME_BASED"])).default(["PYRAMID", "TIME_BASED"]),
  periodizations: z.array(periodizationSchema).default(["LINEAR", "WAVE"]),
});
export type PlanStyleChoices = z.infer<typeof planStyleChoicesSchema>;
