export const TRAINING_PHASES = [
  "AUFBAU",
  "MUSKELAUSDAUER",
  "NEGATIV",
  "DAILY",
  "CUSTOM_1",
  "CUSTOM_2",
  "CUSTOM_3",
  "CUSTOM_4",
  "CUSTOM_5",
] as const;
export type TrainingPhase = (typeof TRAINING_PHASES)[number];

// Default order the plan rotates through, every 8 weeks, always starting on a Monday.
export const TRAINING_PHASE_ROTATION: TrainingPhase[] = [
  "AUFBAU",
  "MUSKELAUSDAUER",
  "NEGATIV",
];

// Pool of custom rotational phase slots that can be added by the user.
export const CUSTOM_TRAINING_PHASES: TrainingPhase[] = [
  "CUSTOM_1",
  "CUSTOM_2",
  "CUSTOM_3",
  "CUSTOM_4",
  "CUSTOM_5",
];

// Shared between the frontend UI and the backend's push notification text, so both sides of a
// phase change always say the same thing. Overridden per-user when custom labels are set.
export const TRAINING_PHASE_LABELS: Record<TrainingPhase, string> = {
  AUFBAU: "Aufbau",
  MUSKELAUSDAUER: "Muskelausdauer",
  NEGATIV: "Negativ",
  DAILY: "Daily",
  CUSTOM_1: "Phase 4",
  CUSTOM_2: "Phase 5",
  CUSTOM_3: "Phase 6",
  CUSTOM_4: "Phase 7",
  CUSTOM_5: "Phase 8",
};

export const GOAL_TYPES = ["WEIGHT", "REPS", "BODYWEIGHT", "CUSTOM"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
