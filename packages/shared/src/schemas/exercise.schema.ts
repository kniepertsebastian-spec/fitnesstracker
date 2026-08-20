import { z } from "zod";

export const exerciseDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  videoUrl: z.string().nullable(),
  imageUrls: z.array(z.string()),
  equipment: z.string().nullable(),
  category: z.string().nullable(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  source: z.string().nullable(),
});
export type ExerciseDto = z.infer<typeof exerciseDtoSchema>;

export const createExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  videoUrl: z.string().url().optional(),
  equipment: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  primaryMuscles: z.array(z.string()).optional(),
  secondaryMuscles: z.array(z.string()).optional(),
});
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const updateExerciseSchema = createExerciseSchema.partial();
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;

// Every registered adapter's name is a valid value here; kept as a plain string (not a
// literal union) so adding a new source adapter never requires a shared-package release.
export const importExercisesSchema = z.object({
  source: z.string().min(1),
});
export type ImportExercisesInput = z.infer<typeof importExercisesSchema>;

export const importSummaryDtoSchema = z.object({
  source: z.string(),
  fetched: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
});
export type ImportSummaryDto = z.infer<typeof importSummaryDtoSchema>;

export const exerciseFacetsDtoSchema = z.object({
  muscleGroups: z.array(z.string()),
  equipment: z.array(z.string()),
});
export type ExerciseFacetsDto = z.infer<typeof exerciseFacetsDtoSchema>;
