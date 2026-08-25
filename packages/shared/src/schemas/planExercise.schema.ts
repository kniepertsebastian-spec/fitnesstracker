import { z } from "zod";
import { trainingPhaseSchema } from "./trainingPlan.schema.js";

export const planExerciseDtoSchema = z.object({
  id: z.string().uuid(),
  phase: trainingPhaseSchema,
  exerciseId: z.string().uuid(),
  exerciseName: z.string(),
  targetSets: z.number().int().nullable(),
  targetReps: z.number().int().nullable(),
  order: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlanExerciseDto = z.infer<typeof planExerciseDtoSchema>;

export const createPlanExerciseSchema = z.object({
  phase: trainingPhaseSchema,
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().positive().optional(),
  targetReps: z.number().int().positive().optional(),
});
export type CreatePlanExerciseInput = z.infer<typeof createPlanExerciseSchema>;

export const updatePlanExerciseSchema = z.object({
  targetSets: z.number().int().positive().nullable().optional(),
  targetReps: z.number().int().positive().nullable().optional(),
  order: z.number().int().optional(),
});
export type UpdatePlanExerciseInput = z.infer<typeof updatePlanExerciseSchema>;

// Portable plan formats for export/import — CSV/JSON/XML are the three most common
// spreadsheet/interchange formats, hand-rolled without a parser dependency since the row shape
// is small and fixed (see backend planExport.format.ts).
export const planExportFormatSchema = z.enum(["csv", "json", "xml"]);
export type PlanExportFormat = z.infer<typeof planExportFormatSchema>;

export const planImportResultSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  errors: z.array(z.string()),
});
export type PlanImportResult = z.infer<typeof planImportResultSchema>;
