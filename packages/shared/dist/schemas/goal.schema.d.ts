import { z } from "zod";
export declare const goalTypeSchema: z.ZodEnum<{
    WEIGHT: "WEIGHT";
    REPS: "REPS";
    BODYWEIGHT: "BODYWEIGHT";
    CUSTOM: "CUSTOM";
}>;
export declare const goalDtoSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        WEIGHT: "WEIGHT";
        REPS: "REPS";
        BODYWEIGHT: "BODYWEIGHT";
        CUSTOM: "CUSTOM";
    }>;
    exerciseId: z.ZodNullable<z.ZodString>;
    exerciseName: z.ZodNullable<z.ZodString>;
    targetValue: z.ZodNumber;
    targetDate: z.ZodNullable<z.ZodString>;
    achievedAt: z.ZodNullable<z.ZodString>;
    currentValue: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type GoalDto = z.infer<typeof goalDtoSchema>;
export declare const createGoalSchema: z.ZodObject<{
    type: z.ZodEnum<{
        WEIGHT: "WEIGHT";
        REPS: "REPS";
        BODYWEIGHT: "BODYWEIGHT";
        CUSTOM: "CUSTOM";
    }>;
    exerciseId: z.ZodOptional<z.ZodString>;
    targetValue: z.ZodNumber;
    targetDate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export declare const updateGoalSchema: z.ZodObject<{
    targetValue: z.ZodOptional<z.ZodNumber>;
    targetDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    achievedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export declare const goalSuggestionTierSchema: z.ZodObject<{
    targetValue: z.ZodNumber;
    targetDate: z.ZodString;
}, z.core.$strip>;
export type GoalSuggestionTierDto = z.infer<typeof goalSuggestionTierSchema>;
export declare const goalSuggestionDtoSchema: z.ZodObject<{
    exerciseId: z.ZodString;
    exerciseName: z.ZodString;
    type: z.ZodEnum<{
        WEIGHT: "WEIGHT";
        REPS: "REPS";
        BODYWEIGHT: "BODYWEIGHT";
        CUSTOM: "CUSTOM";
    }>;
    currentBestValue: z.ZodNumber;
    plateauDetected: z.ZodBoolean;
    tiers: z.ZodObject<{
        conservative: z.ZodObject<{
            targetValue: z.ZodNumber;
            targetDate: z.ZodString;
        }, z.core.$strip>;
        realistic: z.ZodObject<{
            targetValue: z.ZodNumber;
            targetDate: z.ZodString;
        }, z.core.$strip>;
        ambitious: z.ZodObject<{
            targetValue: z.ZodNumber;
            targetDate: z.ZodString;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type GoalSuggestionDto = z.infer<typeof goalSuggestionDtoSchema>;
