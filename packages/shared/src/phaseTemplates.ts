import { z } from "zod";
import { CUSTOM_TRAINING_PHASES, DEFAULT_PHASE_WEEKS, TRAINING_PHASE_ROTATION, type TrainingPhase } from "./enums.js";
import { trainingGoalValueSchema, type TrainingGoalValue } from "./schemas/cardioPlan.schema.js";
import type { PhaseConfigItem, PhaseStyle } from "./schemas/trainingPlan.schema.js";

// A suggested order of training phases for a training goal. It is only a proposal: it can be declined,
// and the phases can be renamed, shortened, extended or deleted afterwards. Applying one creates the
// phases empty — the exercises come from the AI generator or are entered by hand.

export interface PhaseTemplatePhase {
  label: string;
  weeks: number;
  style: PhaseStyle;
  // One line on what this phase is about.
  focus: string;
}

export interface PhaseTemplate {
  goal: TrainingGoalValue;
  summary: string;
  phases: PhaseTemplatePhase[];
  // Why this order — shown next to the proposal.
  rationale: string;
}

const DELOAD: PhaseTemplatePhase = {
  label: "Deload",
  weeks: 1,
  style: "DELOAD",
  focus: "Etwa halbes Volumen und leichtere Gewichte: Gelenke und Nervensystem erholen sich, die Leistung kommt danach zurück.",
};

export const PHASE_TEMPLATES: Record<TrainingGoalValue, PhaseTemplate> = {
  MUSCLE_GAIN: {
    goal: "MUSCLE_GAIN",
    summary: "Aufbau, kurze Erholung, Kraftbasis, Definition, Erhalt",
    phases: [
      { label: "Hypertrophie", weeks: 8, style: "HYPERTROPHY", focus: "Moderates bis hohes Volumen, 8–12 Wiederholungen, nah am Muskelversagen." },
      DELOAD,
      { label: "Maximalkraft", weeks: 6, style: "STRENGTH", focus: "Schwere Grundübungen, 3–6 Wiederholungen, lange Pausen. Mehr Kraft erlaubt später mehr Gewicht im Aufbau." },
      { label: "Definition", weeks: 6, style: "MAINTAIN", focus: "Kraft halten, höhere Wiederholungen, etwas mehr Cardio, Kalorien leicht unter Bedarf." },
      { label: "Erhalt", weeks: 4, style: "MAINTAIN", focus: "Auf Erhaltungsniveau trainieren und essen — Pause vom Diätdruck, bevor ein neuer Aufbau startet." },
    ],
    rationale:
      "Aufbau- und Kraftphasen wechseln sich ab: Muskelmasse braucht Volumen, schwere Phasen heben die Kraftbasis für den nächsten Aufbau. Ein kurzer Deload fängt angesammelte Ermüdung ab, Definition und Erhalt trennen Fettabbau und Aufbau.",
  },
  STRENGTH: {
    goal: "STRENGTH",
    summary: "Grundlagen, Kraftaufbau, Maximalkraft, Peaking, Deload",
    phases: [
      { label: "Grundlagen", weeks: 4, style: "HYPERTROPHY", focus: "Technik und Arbeitskapazität: mittleres Volumen, 6–10 Wiederholungen." },
      { label: "Kraftaufbau", weeks: 6, style: "STRENGTH", focus: "Mehr Intensität, 4–6 Wiederholungen, Grundübungen im Mittelpunkt." },
      { label: "Maximalkraft", weeks: 4, style: "STRENGTH", focus: "Schwer und wenig Wiederholungen (1–3), volle Pausen, weniger Zusatzübungen." },
      { label: "Peaking", weeks: 2, style: "STRENGTH", focus: "Volumen runter, Intensität hoch, Bestleistungen testen." },
      DELOAD,
    ],
    rationale:
      "Klassischer Blockaufbau: erst Volumen und Technik, dann steigende Intensität, am Ende wenig Volumen bei hoher Last, damit sich die Kraft zeigen kann. Danach wieder Erholung.",
  },
  ENDURANCE: {
    goal: "ENDURANCE",
    summary: "Grundlagen, Kraftausdauer, Intensivierung, Deload",
    phases: [
      { label: "Grundlagen", weeks: 4, style: "ENDURANCE", focus: "Technik und Gewöhnung, 12–15 Wiederholungen, mäßige Pausen." },
      { label: "Kraftausdauer", weeks: 8, style: "ENDURANCE", focus: "15–25 Wiederholungen, kurze Pausen (30–60 s), Volumen schrittweise steigern." },
      { label: "Intensivierung", weeks: 4, style: "ENDURANCE", focus: "Zirkel und Supersätze mit sehr kurzen Pausen, hohe Dichte." },
      DELOAD,
    ],
    rationale:
      "Erst die Belastung verträglich aufbauen, dann Dauer und Dichte steigern. Der Wechsel zu Zirkeln erhöht den Reiz, ohne die Last zu erhöhen; der Deload gibt Zeit zur Anpassung.",
  },
  FAT_LOSS: {
    goal: "FAT_LOSS",
    summary: "Defizit, Diet-Break, Defizit, Erhalt — Kraft bleibt im Training",
    phases: [
      { label: "Fettabbau 1", weeks: 6, style: "STRENGTH", focus: "Schwer weitertrainieren, um Muskeln zu halten; Volumen eher moderat, Cardio nach Bedarf." },
      { label: "Diet-Break", weeks: 1, style: "DELOAD", focus: "Eine Woche Erhaltungskalorien, Training locker — Pause vom Defizit." },
      { label: "Fettabbau 2", weeks: 6, style: "STRENGTH", focus: "Zweite Defizitphase mit unveränderter Last in den Grundübungen." },
      { label: "Erhalt", weeks: 4, style: "MAINTAIN", focus: "Gewicht halten, Gewohnheiten festigen." },
    ],
    rationale:
      "Muskeln bleiben am besten erhalten, wenn die Last hoch bleibt und das Defizit nicht zu lange am Stück läuft. Geplante Pausen im Defizit können das Durchhalten erleichtern; die Studienlage dazu ist begrenzt, deshalb ist die Pause kurz und optional.",
  },
  GENERAL_FITNESS: {
    goal: "GENERAL_FITNESS",
    summary: "Eingewöhnung, Aufbau, Muskelausdauer, Deload, Kraft",
    phases: [
      { label: "Eingewöhnung", weeks: 4, style: "HYPERTROPHY", focus: "Bewegungen lernen, leichte Gewichte, 10–15 Wiederholungen." },
      { label: "Aufbau", weeks: 8, style: "HYPERTROPHY", focus: "Hypertrophie-Fokus: 3–4 Sätze, 8–12 Wiederholungen." },
      { label: "Muskelausdauer", weeks: 6, style: "ENDURANCE", focus: "15–20 Wiederholungen, kurze Pausen." },
      DELOAD,
      { label: "Kraft", weeks: 6, style: "STRENGTH", focus: "Schwerere Grundübungen, 4–6 Wiederholungen." },
    ],
    rationale:
      "Abwechslung statt Spezialisierung: Jede Phase setzt einen anderen Reiz, so bleiben Kraft, Muskeln und Ausdauer im Gleichgewicht. Der Deload sitzt nach dem anstrengendsten Block.",
  },
};

// Phase slots a template is laid onto, in order. DAILY is not part of the rotation and stays as it is.
export const PHASE_TEMPLATE_SLOTS: TrainingPhase[] = [...TRAINING_PHASE_ROTATION, ...CUSTOM_TRAINING_PHASES];

export function phaseTemplateConfigs(goal: TrainingGoalValue): PhaseConfigItem[] {
  return PHASE_TEMPLATES[goal].phases.map((p, i) => ({
    phase: PHASE_TEMPLATE_SLOTS[i],
    label: p.label,
    isDaily: false,
    weeks: p.weeks,
    style: p.style,
    focus: p.focus,
  }));
}

export function phaseTemplateWeeks(goal: TrainingGoalValue): number {
  return PHASE_TEMPLATES[goal].phases.reduce((sum, p) => sum + p.weeks, 0);
}

// Length of a phase in weeks, as configured on the plan (older plans have none: 8).
export function getPhaseWeeks(configs: Pick<PhaseConfigItem, "phase" | "weeks">[] | undefined, phase: TrainingPhase): number {
  return configs?.find((c) => c.phase === phase)?.weeks ?? DEFAULT_PHASE_WEEKS;
}

// What the AI generator aims for and what the plan page says, per style. Sets/reps/pause are the
// defaults the generator falls back to; the guidance sentence goes into its prompt.
export interface PhaseStyleProfile {
  guidance: string;
  defaults: { sets: number; repMin: number; repMax: number; rir: number; restSeconds: number };
}

export const PHASE_STYLE_PROFILES: Record<PhaseStyle, PhaseStyleProfile> = {
  HYPERTROPHY: {
    guidance: "Hypertrophie-Fokus: 3-4 Sätze, 8-12 Wiederholungen, RIR 1-2 (nah am Muskelversagen).",
    defaults: { sets: 3, repMin: 8, repMax: 12, rir: 2, restSeconds: 120 },
  },
  STRENGTH: {
    guidance: "Kraft-Fokus: 4-5 Sätze, 3-6 Wiederholungen, RIR 1-3, lange Pausen (2-4 Minuten), schwere Grundübungen zuerst.",
    defaults: { sets: 4, repMin: 3, repMax: 6, rir: 2, restSeconds: 180 },
  },
  ENDURANCE: {
    guidance: "Kraftausdauer: 3 Sätze, 15-25 Wiederholungen, kurze Satzpausen (30-60s), leichtere Gewichte.",
    defaults: { sets: 3, repMin: 15, repMax: 20, rir: 2, restSeconds: 60 },
  },
  DELOAD: {
    guidance:
      "Deload / Erholung: etwa halbes Volumen (2 Sätze pro Übung), 8-12 Wiederholungen mit leichten Gewichten, RIR 4-5, nie bis nah ans Versagen.",
    defaults: { sets: 2, repMin: 8, repMax: 12, rir: 4, restSeconds: 90 },
  },
  MAINTAIN: {
    guidance:
      "Erhalt: 2-3 Sätze, 6-10 Wiederholungen, RIR 2, Gewichte aus der letzten Aufbau- oder Kraftphase halten, wenig Zusatzvolumen.",
    defaults: { sets: 3, repMin: 6, repMax: 10, rir: 2, restSeconds: 120 },
  },
};

export const applyPhaseTemplateSchema = z.object({
  goal: trainingGoalValueSchema,
  // Delete the exercises (and cardio/stretch items) of the rotation phases. Without it the call is
  // refused while any of them still has entries, so nothing is lost by accident.
  clearExisting: z.boolean().optional().default(false),
});
export type ApplyPhaseTemplateInput = z.input<typeof applyPhaseTemplateSchema>;
