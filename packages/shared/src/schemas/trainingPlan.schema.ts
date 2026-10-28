import { z } from "zod";
import { TRAINING_PHASES } from "../enums.js";

export const trainingPhaseSchema = z.enum(TRAINING_PHASES);

export const phaseConfigItemSchema = z.object({
  phase: trainingPhaseSchema,
  label: z.string().trim().min(1).max(40),
  isDaily: z.boolean().default(false),
});
export type PhaseConfigItem = z.infer<typeof phaseConfigItemSchema>;

export const changeTrainingPhaseSchema = z.object({
  phase: trainingPhaseSchema,
});
export type ChangeTrainingPhaseInput = z.infer<typeof changeTrainingPhaseSchema>;

export const addTrainingPhaseSchema = z.object({
  label: z.string().trim().min(1, "Name darf nicht leer sein").max(40, "Maximal 40 Zeichen"),
  isDaily: z.boolean().optional().default(false),
});
export type AddTrainingPhaseInput = z.infer<typeof addTrainingPhaseSchema>;

export const renameTrainingPhaseSchema = z.object({
  label: z.string().trim().min(1, "Name darf nicht leer sein").max(40, "Maximal 40 Zeichen"),
});
export type RenameTrainingPhaseInput = z.infer<typeof renameTrainingPhaseSchema>;

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
  phases: z.array(phaseConfigItemSchema),
  history: z.array(trainingPlanPhaseHistoryDtoSchema),
});
export type TrainingPlanDto = z.infer<typeof trainingPlanDtoSchema>;

export const updateTrainingPlanRemarksSchema = z.object({
  remarks: z.string().trim().max(2000).nullable(),
});
export type UpdateTrainingPlanRemarksInput = z.infer<typeof updateTrainingPlanRemarksSchema>;
