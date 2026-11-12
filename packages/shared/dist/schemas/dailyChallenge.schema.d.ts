import { z } from "zod";
export declare const dailyChallengeCategorySchema: z.ZodEnum<{
    TECHNIQUE: "TECHNIQUE";
    PROGRESSION: "PROGRESSION";
    VOLUME: "VOLUME";
    CONSISTENCY: "CONSISTENCY";
    RECOVERY: "RECOVERY";
}>;
export type DailyChallengeCategory = z.infer<typeof dailyChallengeCategorySchema>;
export declare const dailyChallengeItemDtoSchema: z.ZodObject<{
    id: z.ZodString;
    exerciseId: z.ZodString;
    exerciseName: z.ZodString;
    category: z.ZodEnum<{
        TECHNIQUE: "TECHNIQUE";
        PROGRESSION: "PROGRESSION";
        VOLUME: "VOLUME";
        CONSISTENCY: "CONSISTENCY";
        RECOVERY: "RECOVERY";
    }>;
    targetReps: z.ZodNumber;
    completedReps: z.ZodNumber;
    rotationsRemaining: z.ZodNumber;
}, z.core.$strip>;
export type DailyChallengeItemDto = z.infer<typeof dailyChallengeItemDtoSchema>;
export declare const addChallengeRepsSchema: z.ZodObject<{
    delta: z.ZodNumber;
}, z.core.$strip>;
export type AddChallengeRepsInput = z.infer<typeof addChallengeRepsSchema>;
