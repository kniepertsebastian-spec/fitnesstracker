import { z } from "zod";
export declare const planExerciseDtoSchema: z.ZodObject<{
    id: z.ZodString;
    phase: z.ZodEnum<{
        AUFBAU: "AUFBAU";
        MUSKELAUSDAUER: "MUSKELAUSDAUER";
        NEGATIV: "NEGATIV";
        DAILY: "DAILY";
        CUSTOM_1: "CUSTOM_1";
        CUSTOM_2: "CUSTOM_2";
        CUSTOM_3: "CUSTOM_3";
        CUSTOM_4: "CUSTOM_4";
        CUSTOM_5: "CUSTOM_5";
    }>;
    exerciseId: z.ZodString;
    exerciseName: z.ZodString;
    targetSets: z.ZodNullable<z.ZodNumber>;
    targetReps: z.ZodNullable<z.ZodNumber>;
    order: z.ZodNumber;
    dayLabel: z.ZodNullable<z.ZodString>;
    repRangeMin: z.ZodNullable<z.ZodNumber>;
    repRangeMax: z.ZodNullable<z.ZodNumber>;
    targetRir: z.ZodNullable<z.ZodNumber>;
    restSeconds: z.ZodNullable<z.ZodNumber>;
    notes: z.ZodNullable<z.ZodString>;
    startWeightKg: z.ZodNullable<z.ZodNumber>;
    alternativeExerciseId: z.ZodNullable<z.ZodString>;
    alternativeExerciseName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type PlanExerciseDto = z.infer<typeof planExerciseDtoSchema>;
export declare const createPlanExerciseSchema: z.ZodObject<{
    phase: z.ZodEnum<{
        AUFBAU: "AUFBAU";
        MUSKELAUSDAUER: "MUSKELAUSDAUER";
        NEGATIV: "NEGATIV";
        DAILY: "DAILY";
        CUSTOM_1: "CUSTOM_1";
        CUSTOM_2: "CUSTOM_2";
        CUSTOM_3: "CUSTOM_3";
        CUSTOM_4: "CUSTOM_4";
        CUSTOM_5: "CUSTOM_5";
    }>;
    exerciseId: z.ZodString;
    targetSets: z.ZodOptional<z.ZodNumber>;
    targetReps: z.ZodOptional<z.ZodNumber>;
    dayLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type CreatePlanExerciseInput = z.infer<typeof createPlanExerciseSchema>;
export declare const updatePlanExerciseSchema: z.ZodObject<{
    exerciseId: z.ZodOptional<z.ZodString>;
    targetSets: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    targetReps: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    order: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type UpdatePlanExerciseInput = z.infer<typeof updatePlanExerciseSchema>;
export declare const planExportFormatSchema: z.ZodEnum<{
    csv: "csv";
    json: "json";
    xml: "xml";
}>;
export type PlanExportFormat = z.infer<typeof planExportFormatSchema>;
export declare const planImportResultSchema: z.ZodObject<{
    created: z.ZodNumber;
    updated: z.ZodNumber;
    errors: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type PlanImportResult = z.infer<typeof planImportResultSchema>;
export declare const progressionSuggestionSchema: z.ZodObject<{
    mode: z.ZodEnum<{
        reps: "reps";
        weight: "weight";
    }>;
    lastWeightKg: z.ZodNumber;
    lastReps: z.ZodNumber;
    targetReps: z.ZodNumber;
    hitTarget: z.ZodBoolean;
    deloadSuggested: z.ZodBoolean;
    suggestedWeightKg: z.ZodNumber;
    suggestedReps: z.ZodNumber;
}, z.core.$strip>;
export type ProgressionSuggestion = z.infer<typeof progressionSuggestionSchema>;
export declare const exerciseOptionSchema: z.ZodObject<{
    exerciseId: z.ZodString;
    exerciseName: z.ZodString;
    equipment: z.ZodNullable<z.ZodString>;
    primaryMuscle: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type ExerciseOptionDto = z.infer<typeof exerciseOptionSchema>;
export declare const planDiaryExerciseDtoSchema: z.ZodObject<{
    id: z.ZodString;
    phase: z.ZodEnum<{
        AUFBAU: "AUFBAU";
        MUSKELAUSDAUER: "MUSKELAUSDAUER";
        NEGATIV: "NEGATIV";
        DAILY: "DAILY";
        CUSTOM_1: "CUSTOM_1";
        CUSTOM_2: "CUSTOM_2";
        CUSTOM_3: "CUSTOM_3";
        CUSTOM_4: "CUSTOM_4";
        CUSTOM_5: "CUSTOM_5";
    }>;
    exerciseId: z.ZodString;
    exerciseName: z.ZodString;
    targetSets: z.ZodNullable<z.ZodNumber>;
    targetReps: z.ZodNullable<z.ZodNumber>;
    order: z.ZodNumber;
    dayLabel: z.ZodNullable<z.ZodString>;
    repRangeMin: z.ZodNullable<z.ZodNumber>;
    repRangeMax: z.ZodNullable<z.ZodNumber>;
    targetRir: z.ZodNullable<z.ZodNumber>;
    restSeconds: z.ZodNullable<z.ZodNumber>;
    notes: z.ZodNullable<z.ZodString>;
    startWeightKg: z.ZodNullable<z.ZodNumber>;
    alternativeExerciseId: z.ZodNullable<z.ZodString>;
    alternativeExerciseName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    loggedThisWeek: z.ZodBoolean;
    progression: z.ZodNullable<z.ZodObject<{
        mode: z.ZodEnum<{
            reps: "reps";
            weight: "weight";
        }>;
        lastWeightKg: z.ZodNumber;
        lastReps: z.ZodNumber;
        targetReps: z.ZodNumber;
        hitTarget: z.ZodBoolean;
        deloadSuggested: z.ZodBoolean;
        suggestedWeightKg: z.ZodNumber;
        suggestedReps: z.ZodNumber;
    }, z.core.$strip>>;
    swapOptions: z.ZodArray<z.ZodObject<{
        exerciseId: z.ZodString;
        exerciseName: z.ZodString;
        equipment: z.ZodNullable<z.ZodString>;
        primaryMuscle: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PlanDiaryExerciseDto = z.infer<typeof planDiaryExerciseDtoSchema>;
export declare const planDayStatusDtoSchema: z.ZodObject<{
    dayLabel: z.ZodNullable<z.ZodString>;
    exercises: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        phase: z.ZodEnum<{
            AUFBAU: "AUFBAU";
            MUSKELAUSDAUER: "MUSKELAUSDAUER";
            NEGATIV: "NEGATIV";
            DAILY: "DAILY";
            CUSTOM_1: "CUSTOM_1";
            CUSTOM_2: "CUSTOM_2";
            CUSTOM_3: "CUSTOM_3";
            CUSTOM_4: "CUSTOM_4";
            CUSTOM_5: "CUSTOM_5";
        }>;
        exerciseId: z.ZodString;
        exerciseName: z.ZodString;
        targetSets: z.ZodNullable<z.ZodNumber>;
        targetReps: z.ZodNullable<z.ZodNumber>;
        order: z.ZodNumber;
        dayLabel: z.ZodNullable<z.ZodString>;
        repRangeMin: z.ZodNullable<z.ZodNumber>;
        repRangeMax: z.ZodNullable<z.ZodNumber>;
        targetRir: z.ZodNullable<z.ZodNumber>;
        restSeconds: z.ZodNullable<z.ZodNumber>;
        notes: z.ZodNullable<z.ZodString>;
        startWeightKg: z.ZodNullable<z.ZodNumber>;
        alternativeExerciseId: z.ZodNullable<z.ZodString>;
        alternativeExerciseName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        loggedThisWeek: z.ZodBoolean;
        progression: z.ZodNullable<z.ZodObject<{
            mode: z.ZodEnum<{
                reps: "reps";
                weight: "weight";
            }>;
            lastWeightKg: z.ZodNumber;
            lastReps: z.ZodNumber;
            targetReps: z.ZodNumber;
            hitTarget: z.ZodBoolean;
            deloadSuggested: z.ZodBoolean;
            suggestedWeightKg: z.ZodNumber;
            suggestedReps: z.ZodNumber;
        }, z.core.$strip>>;
        swapOptions: z.ZodArray<z.ZodObject<{
            exerciseId: z.ZodString;
            exerciseName: z.ZodString;
            equipment: z.ZodNullable<z.ZodString>;
            primaryMuscle: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    completed: z.ZodBoolean;
    addOptions: z.ZodArray<z.ZodObject<{
        exerciseId: z.ZodString;
        exerciseName: z.ZodString;
        equipment: z.ZodNullable<z.ZodString>;
        primaryMuscle: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PlanDayStatusDto = z.infer<typeof planDayStatusDtoSchema>;
export declare const weeklyPlanStatusDtoSchema: z.ZodObject<{
    days: z.ZodArray<z.ZodObject<{
        dayLabel: z.ZodNullable<z.ZodString>;
        exercises: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            phase: z.ZodEnum<{
                AUFBAU: "AUFBAU";
                MUSKELAUSDAUER: "MUSKELAUSDAUER";
                NEGATIV: "NEGATIV";
                DAILY: "DAILY";
                CUSTOM_1: "CUSTOM_1";
                CUSTOM_2: "CUSTOM_2";
                CUSTOM_3: "CUSTOM_3";
                CUSTOM_4: "CUSTOM_4";
                CUSTOM_5: "CUSTOM_5";
            }>;
            exerciseId: z.ZodString;
            exerciseName: z.ZodString;
            targetSets: z.ZodNullable<z.ZodNumber>;
            targetReps: z.ZodNullable<z.ZodNumber>;
            order: z.ZodNumber;
            dayLabel: z.ZodNullable<z.ZodString>;
            repRangeMin: z.ZodNullable<z.ZodNumber>;
            repRangeMax: z.ZodNullable<z.ZodNumber>;
            targetRir: z.ZodNullable<z.ZodNumber>;
            restSeconds: z.ZodNullable<z.ZodNumber>;
            notes: z.ZodNullable<z.ZodString>;
            startWeightKg: z.ZodNullable<z.ZodNumber>;
            alternativeExerciseId: z.ZodNullable<z.ZodString>;
            alternativeExerciseName: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            loggedThisWeek: z.ZodBoolean;
            progression: z.ZodNullable<z.ZodObject<{
                mode: z.ZodEnum<{
                    reps: "reps";
                    weight: "weight";
                }>;
                lastWeightKg: z.ZodNumber;
                lastReps: z.ZodNumber;
                targetReps: z.ZodNumber;
                hitTarget: z.ZodBoolean;
                deloadSuggested: z.ZodBoolean;
                suggestedWeightKg: z.ZodNumber;
                suggestedReps: z.ZodNumber;
            }, z.core.$strip>>;
            swapOptions: z.ZodArray<z.ZodObject<{
                exerciseId: z.ZodString;
                exerciseName: z.ZodString;
                equipment: z.ZodNullable<z.ZodString>;
                primaryMuscle: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        completed: z.ZodBoolean;
        addOptions: z.ZodArray<z.ZodObject<{
            exerciseId: z.ZodString;
            exerciseName: z.ZodString;
            equipment: z.ZodNullable<z.ZodString>;
            primaryMuscle: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    activeDayIndex: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export type WeeklyPlanStatusDto = z.infer<typeof weeklyPlanStatusDtoSchema>;
