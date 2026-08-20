export const TRAINING_PHASES = ["AUFBAU", "MUSKELAUSDAUER", "NEGATIV"] as const;
export type TrainingPhase = (typeof TRAINING_PHASES)[number];

// Order the plan rotates through, every 8 weeks, always starting on a Monday.
export const TRAINING_PHASE_ROTATION: TrainingPhase[] = [
  "AUFBAU",
  "MUSKELAUSDAUER",
  "NEGATIV",
];

export const GOAL_TYPES = ["WEIGHT", "REPS", "BODYWEIGHT", "CUSTOM"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
