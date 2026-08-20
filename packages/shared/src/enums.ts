export const TRAINING_PHASES = ["AUFBAU", "MUSKELAUSDAUER", "NEGATIV"] as const;
export type TrainingPhase = (typeof TRAINING_PHASES)[number];

// Order the plan rotates through, every 8 weeks, always starting on a Monday.
export const TRAINING_PHASE_ROTATION: TrainingPhase[] = [
  "AUFBAU",
  "MUSKELAUSDAUER",
  "NEGATIV",
];

// Shared between the frontend UI and the backend's push notification text, so both sides of a
// phase change always say the same thing.
export const TRAINING_PHASE_LABELS: Record<TrainingPhase, string> = {
  AUFBAU: "Aufbau",
  MUSKELAUSDAUER: "Muskelausdauer",
  NEGATIV: "Negativ",
};

export const GOAL_TYPES = ["WEIGHT", "REPS", "BODYWEIGHT", "CUSTOM"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
