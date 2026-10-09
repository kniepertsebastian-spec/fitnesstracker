import { z } from "zod";
import { TRAINING_PHASES } from "../enums.js";

export const trainingPhaseSchema = z.enum(TRAINING_PHASES);

export const trainingPlanPhaseHistoryDtoSchema = z.object({
  id: z.string().uuid(),
  phase: trainingPhaseSchema,
  startedOn: z.string(),
  endedOn: z.string().nullable(),
});
export type TrainingPlanPhaseHistoryDto = z.infer<typeof trainingPlanPhaseHistoryDtoSchema>;

export const trainingPlanDtoSchema = z.object({
  currentPhase: trainingPhaseSchema,
  phaseStartedOn: z.string(),
  // Null while the rotation is paused — there's no meaningful "next rotation date" to show
  // while the clock isn't advancing.
  nextRotationOn: z.string().nullable(),
  pausedAt: z.string().nullable(),
  // Weeks added to the current phase via "+1 Woche" (phase length = 8 + this).
  extensionWeeks: z.number().int().min(0),
  // F9: null until the user picks one. Kept as a plain enum here (not imported from
  // cardioPlan.schema) to avoid a circular import between the two schema files.
  trainingGoal: z.enum(["MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_LOSS", "GENERAL_FITNESS"]).nullable(),
  remarks: z.string().nullable(),
  detectedAsymmetries: z.array(z.string()),
  asymmetryAnalyzedAt: z.string().nullable(),
  history: z.array(trainingPlanPhaseHistoryDtoSchema),
});
export type TrainingPlanDto = z.infer<typeof trainingPlanDtoSchema>;

export const updateTrainingPlanRemarksSchema = z.object({
  remarks: z.string().trim().max(2000).nullable(),
});
export type UpdateTrainingPlanRemarksInput = z.infer<typeof updateTrainingPlanRemarksSchema>;
