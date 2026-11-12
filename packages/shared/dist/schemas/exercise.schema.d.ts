import { z } from "zod";
export declare const exerciseDtoSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    videoUrl: z.ZodNullable<z.ZodString>;
    imageUrls: z.ZodArray<z.ZodString>;
    equipment: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodString>;
    primaryMuscles: z.ZodArray<z.ZodString>;
    secondaryMuscles: z.ZodArray<z.ZodString>;
    source: z.ZodNullable<z.ZodString>;
    isActive: z.ZodBoolean;
}, z.core.$strip>;
export type ExerciseDto = z.infer<typeof exerciseDtoSchema>;
export declare const createExerciseSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    videoUrl: z.ZodOptional<z.ZodString>;
    equipment: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    primaryMuscles: z.ZodOptional<z.ZodArray<z.ZodString>>;
    secondaryMuscles: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export declare const updateExerciseSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    videoUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    equipment: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    category: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    primaryMuscles: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    secondaryMuscles: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export declare const importExercisesSchema: z.ZodObject<{
    source: z.ZodString;
}, z.core.$strip>;
export type ImportExercisesInput = z.infer<typeof importExercisesSchema>;
export declare const importSummaryDtoSchema: z.ZodObject<{
    source: z.ZodString;
    fetched: z.ZodNumber;
    created: z.ZodNumber;
    updated: z.ZodNumber;
}, z.core.$strip>;
export type ImportSummaryDto = z.infer<typeof importSummaryDtoSchema>;
export declare const exerciseFacetsDtoSchema: z.ZodObject<{
    muscleGroups: z.ZodArray<z.ZodString>;
    equipment: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type ExerciseFacetsDto = z.infer<typeof exerciseFacetsDtoSchema>;
