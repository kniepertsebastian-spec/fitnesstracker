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
  nextRotationOn: z.string(),
  history: z.array(trainingPlanPhaseHistoryDtoSchema),
});
export type TrainingPlanDto = z.infer<typeof trainingPlanDtoSchema>;
