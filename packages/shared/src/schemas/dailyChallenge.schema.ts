import { z } from "zod";

export const dailyChallengeItemDtoSchema = z.object({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
  exerciseName: z.string(),
  targetReps: z.number().int(),
  completedReps: z.number().int(),
});
export type DailyChallengeItemDto = z.infer<typeof dailyChallengeItemDtoSchema>;

// Positive to log reps done, negative to correct a mistap — zero would be a no-op.
export const addChallengeRepsSchema = z.object({
  delta: z.number().int().refine((v) => v !== 0, "delta must not be zero"),
});
export type AddChallengeRepsInput = z.infer<typeof addChallengeRepsSchema>;
