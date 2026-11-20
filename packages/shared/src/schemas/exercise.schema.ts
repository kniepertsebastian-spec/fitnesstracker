import { z } from "zod";

export const exerciseDtoSchema = z.object({
  id: z.string().uuid(),
  // The German name where there is one, else the English one.
  name: z.string(),
  // The original (English) name, so a search for "deadlift" finds "Kreuzheben" without a server.
  // Optional: responses cached by an older build do not have it.
  nameEn: z.string().optional(),
  // German when the exercise has a German name and a German description, else as stored.
  description: z.string().nullable(),
  descriptionLang: z.enum(["de", "en"]).nullable().optional(),
  videoUrl: z.string().nullable(),
  imageUrls: z.array(z.string()),
  equipment: z.string().nullable(),
  category: z.string().nullable(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  source: z.string().nullable(),
  isActive: z.boolean(),
});
export type ExerciseDto = z.infer<typeof exerciseDtoSchema>;

// The whole catalog visible to a user in one go, for the offline copy. `version` changes whenever an
// exercise was added, changed or removed; a client that sends it back gets `unchanged` instead of the list.
export const exerciseCatalogDtoSchema = z.object({
  version: z.string(),
  unchanged: z.boolean().optional(),
  items: z.array(exerciseDtoSchema).optional(),
});
export type ExerciseCatalogDto = z.infer<typeof exerciseCatalogDtoSchema>;

// Progress of the operator's run that translates the exercise descriptions into German.
export const descriptionTranslationStateSchema = z.object({
  running: z.boolean(),
  // Exercises still without a German description.
  remaining: z.number().int(),
  translated: z.number().int(),
  failed: z.number().int(),
  error: z.string().nullable(),
  // Only the operator account may start the run; the others never see the panel.
  isOperator: z.boolean(),
});
export type DescriptionTranslationState = z.infer<typeof descriptionTranslationStateSchema>;

export const createExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  // Rendered as a link/player, so only plain web addresses (no javascript:, data: ...).
  videoUrl: z
    .string()
    .url()
    .max(2048)
    .refine((value) => /^https?:\/\//i.test(value), "Nur http(s)-Adressen sind erlaubt.")
    .optional(),
  equipment: z.string().max(200).optional(),
  category: z.string().max(200).optional(),
  primaryMuscles: z.array(z.string()).optional(),
  secondaryMuscles: z.array(z.string()).optional(),
});
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

// `isActive` isn't part of createExerciseSchema — a new exercise is always created active, only
// an existing one can be deactivated/reactivated afterwards.
export const updateExerciseSchema = createExerciseSchema.partial().extend({
  isActive: z.boolean().optional(),
});
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
