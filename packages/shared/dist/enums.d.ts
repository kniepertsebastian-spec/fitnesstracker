export declare const TRAINING_PHASES: readonly ["AUFBAU", "MUSKELAUSDAUER", "NEGATIV", "DAILY", "CUSTOM_1", "CUSTOM_2", "CUSTOM_3", "CUSTOM_4", "CUSTOM_5"];
export type TrainingPhase = (typeof TRAINING_PHASES)[number];
export declare const TRAINING_PHASE_ROTATION: TrainingPhase[];
export declare const CUSTOM_TRAINING_PHASES: TrainingPhase[];
export declare const TRAINING_PHASE_LABELS: Record<TrainingPhase, string>;
export declare const GOAL_TYPES: readonly ["WEIGHT", "REPS", "BODYWEIGHT", "CUSTOM"];
export type GoalType = (typeof GOAL_TYPES)[number];
