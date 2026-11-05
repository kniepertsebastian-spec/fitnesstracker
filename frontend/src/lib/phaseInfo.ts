import { TRAINING_PHASE_LABELS, type PhaseConfigItem, type TrainingPhase } from "@fitnesstracker/shared";

// Short rule per phase, matching the progression rules in the backend's planWeekStatus.service.ts
export const PHASE_RULES: Record<TrainingPhase, string> = {
  AUFBAU: "Gewicht steigern bei 10 Wdh.",
  MUSKELAUSDAUER: "Wdh. steigern bis 20",
  NEGATIV: "Schwer, langsam ablassen · 5 Wdh.",
  DAILY: "Tägliche Routine · unabhängig vom Rotationsplan",
  CUSTOM_1: "Individuelle Trainingsphase · 10 Wdh.",
  CUSTOM_2: "Individuelle Trainingsphase · 10 Wdh.",
  CUSTOM_3: "Individuelle Trainingsphase · 10 Wdh.",
  CUSTOM_4: "Individuelle Trainingsphase · 10 Wdh.",
  CUSTOM_5: "Individuelle Trainingsphase · 10 Wdh.",
};

export type PhaseTone = "accent" | "info" | "warning";

export const PHASE_TONES: Record<TrainingPhase, PhaseTone> = {
  AUFBAU: "accent",
  MUSKELAUSDAUER: "info",
  NEGATIV: "warning",
  DAILY: "info",
  CUSTOM_1: "accent",
  CUSTOM_2: "info",
  CUSTOM_3: "warning",
  CUSTOM_4: "accent",
  CUSTOM_5: "info",
};

export const PHASE_DOT: Record<TrainingPhase, string> = {
  AUFBAU: "bg-accent",
  MUSKELAUSDAUER: "bg-info",
  NEGATIV: "bg-warning",
  DAILY: "bg-magenta",
  CUSTOM_1: "bg-accent",
  CUSTOM_2: "bg-info",
  CUSTOM_3: "bg-warning",
  CUSTOM_4: "bg-accent",
  CUSTOM_5: "bg-info",
};

export function getPhaseDisplayName(
  phase: TrainingPhase,
  phases?: PhaseConfigItem[],
): string {
  const found = phases?.find((p) => p.phase === phase);
  return found?.label ?? TRAINING_PHASE_LABELS[phase] ?? phase;
}
