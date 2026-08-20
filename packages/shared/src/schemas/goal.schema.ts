import { z } from "zod";
import { GOAL_TYPES } from "../enums.js";

export const goalTypeSchema = z.enum(GOAL_TYPES);

export const goalDtoSchema = z.object({
  id: z.string().uuid(),
  type: goalTypeSchema,
  exerciseId: z.string().uuid().nullable(),
  exerciseName: z.string().nullable(),
  targetValue: z.number(),
  targetDate: z.string().nullable(),
  achievedAt: z.string().nullable(),
  // Best value logged so far for WEIGHT/REPS goals (derived from workout logs); null for
  // BODYWEIGHT/CUSTOM goals or exercise-linked goals with no logs yet — there's nothing in the
  // app to derive those from automatically, so "achieved" for them is a manual toggle.
  currentValue: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GoalDto = z.infer<typeof goalDtoSchema>;

export const createGoalSchema = z
  .object({
    type: goalTypeSchema,
    exerciseId: z.string().uuid().optional(),
    targetValue: z.number().positive(),
    targetDate: z.string().datetime().optional(),
  })
  .refine((data) => (data.type === "WEIGHT" || data.type === "REPS" ? !!data.exerciseId : true), {
    message: "exerciseId is required for WEIGHT/REPS goals",
    path: ["exerciseId"],
  });
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

// Type and exercise are immutable after creation — editing a goal only ever adjusts the target,
// the deadline, or marks it (un)achieved.
export const updateGoalSchema = z.object({
  targetValue: z.number().positive().optional(),
  targetDate: z.string().datetime().nullable().optional(),
  achievedAt: z.string().datetime().nullable().optional(),
});
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
