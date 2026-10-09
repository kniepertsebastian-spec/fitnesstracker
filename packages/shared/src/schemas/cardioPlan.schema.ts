import { z } from "zod";
import { cardioMachineSchema } from "./cardioLog.schema.js";
import { trainingPhaseSchema } from "./trainingPlan.schema.js";

// Training goal stored on the plan (F9). Same five goals as the AI questionnaire's
// `trainingGoalSchema` (lower-case there because it predates this), upper-case here to match the
// Prisma enum like every other persisted enum in this project.
export const TRAINING_GOALS = ["MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_LOSS", "GENERAL_FITNESS"] as const;
export const trainingGoalValueSchema = z.enum(TRAINING_GOALS);
export type TrainingGoalValue = z.infer<typeof trainingGoalValueSchema>;

export const TRAINING_GOAL_LABELS: Record<TrainingGoalValue, string> = {
  MUSCLE_GAIN: "Muskelaufbau",
  STRENGTH: "Kraft",
  ENDURANCE: "Ausdauer",
  FAT_LOSS: "Fettabbau",
  GENERAL_FITNESS: "Allgemeine Fitness",
};

export const CARDIO_MACHINE_LABELS: Record<z.infer<typeof cardioMachineSchema>, string> = {
  TREADMILL: "Laufband",
  BIKE: "Rad",
  STEPPER: "Stepper",
  STAIRMASTER: "Stairmaster",
};

export const updateTrainingGoalSchema = z.object({
  goal: trainingGoalValueSchema.nullable(),
});
export type UpdateTrainingGoalInput = z.infer<typeof updateTrainingGoalSchema>;

// WARMUP = before the strength part, AFTER = right after it, FREE = a session on a day without
// strength training.
export const cardioSlotSchema = z.enum(["WARMUP", "AFTER", "FREE"]);
export type CardioSlot = z.infer<typeof cardioSlotSchema>;

export const CARDIO_SLOT_LABELS: Record<CardioSlot, string> = {
  WARMUP: "Vorher",
  AFTER: "Nachher",
  FREE: "Freier Tag",
};

export const cardioPlanItemSchema = z.object({
  slot: cardioSlotSchema,
  machine: cardioMachineSchema,
  durationMinutes: z.number().int().min(1).max(180),
  // Free text like the cardio log's intensity ("Zone 2", "120 W", "8 × 30 s zügig / 90 s locker").
  intensity: z.string().trim().min(1).max(80),
});
export type CardioPlanItem = z.infer<typeof cardioPlanItemSchema>;

export const cardioPlanDayDtoSchema = z.object({
  dayLabel: z.string().nullable(),
  isLegDay: z.boolean(),
  // "auto" = derived from goal + day by the rule, "custom" = the user's own saved version.
  source: z.enum(["auto", "custom"]),
  items: z.array(cardioPlanItemSchema),
});
export type CardioPlanDayDto = z.infer<typeof cardioPlanDayDtoSchema>;

export const cardioPlanDtoSchema = z.object({
  phase: trainingPhaseSchema,
  goal: trainingGoalValueSchema.nullable(),
  // One sentence explaining the suggestion for the (effective) goal.
  reason: z.string(),
  days: z.array(cardioPlanDayDtoSchema),
  free: z.object({
    source: z.enum(["auto", "custom"]),
    items: z.array(cardioPlanItemSchema),
  }),
});
export type CardioPlanDto = z.infer<typeof cardioPlanDtoSchema>;

const dayItemSchema = cardioPlanItemSchema.extend({ slot: z.enum(["WARMUP", "AFTER"]) });
const freeItemSchema = cardioPlanItemSchema.extend({ slot: z.literal("FREE") });

export const saveCardioPlanDaySchema = z.object({
  phase: trainingPhaseSchema,
  dayLabel: z.string().max(100).nullable(),
  items: z.array(dayItemSchema).max(6),
});
export type SaveCardioPlanDayInput = z.infer<typeof saveCardioPlanDaySchema>;

export const saveCardioPlanFreeSchema = z.object({
  phase: trainingPhaseSchema,
  items: z.array(freeItemSchema).max(7),
});
export type SaveCardioPlanFreeInput = z.infer<typeof saveCardioPlanFreeSchema>;

export const resetCardioPlanSchema = z.object({
  phase: trainingPhaseSchema,
  // Omitted = reset the free days; null = the unlabelled single day; a string = that split day.
  dayLabel: z.string().max(100).nullable().optional(),
  scope: z.enum(["day", "free"]),
});
export type ResetCardioPlanInput = z.infer<typeof resetCardioPlanSchema>;
