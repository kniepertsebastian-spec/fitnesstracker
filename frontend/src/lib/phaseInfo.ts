import type { TrainingPhase } from "@fitnesstracker/shared";

// Short rule per phase, matching the progression rules in the backend's planWeekStatus.service.ts
// (default targets 10 / 20 / 5 reps).
export const PHASE_RULES: Record<TrainingPhase, string> = {
  AUFBAU: "Gewicht steigern bei 10 Wdh.",
  MUSKELAUSDAUER: "Wdh. steigern bis 20",
  NEGATIV: "Schwer, langsam ablassen · 5 Wdh.",
};

export type PhaseTone = "accent" | "info" | "warning";

// Fixed meaning colors: Aufbau mint, Muskelausdauer blue, Negativ amber.
export const PHASE_TONES: Record<TrainingPhase, PhaseTone> = {
  AUFBAU: "accent",
  MUSKELAUSDAUER: "info",
  NEGATIV: "warning",
};

export const PHASE_DOT: Record<TrainingPhase, string> = {
  AUFBAU: "bg-accent",
  MUSKELAUSDAUER: "bg-info",
  NEGATIV: "bg-warning",
};
