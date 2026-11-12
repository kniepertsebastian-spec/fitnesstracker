import { z } from "zod";
export const dailyChallengeCategorySchema = z.enum([
    "TECHNIQUE",
    "PROGRESSION",
    "VOLUME",
    "CONSISTENCY",
    "RECOVERY",
]);
export const dailyChallengeItemDtoSchema = z.object({
    id: z.string().uuid(),
    exerciseId: z.string().uuid(),
    exerciseName: z.string(),
    category: dailyChallengeCategorySchema,
    targetReps: z.number().int(),
    completedReps: z.number().int(),
    rotationsRemaining: z.number().int(),
});
// Positive to log reps done, negative to correct a mistap — zero would be a no-op.
export const addChallengeRepsSchema = z.object({
    delta: z.number().int().refine((v) => v !== 0, "delta must not be zero"),
});
//# sourceMappingURL=dailyChallenge.schema.js.map