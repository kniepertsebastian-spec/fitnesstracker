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

// A single ambition level within a suggestion — see goalSuggestionDtoSchema.
export const goalSuggestionTierSchema = z.object({
  targetValue: z.number(),
  targetDate: z.string(),
});
export type GoalSuggestionTierDto = z.infer<typeof goalSuggestionTierSchema>;

// An automatically derived candidate goal for an exercise the user has actually been training —
// not a goal itself until the user explicitly adopts one of its three tiers via the normal
// POST /goals. `type` is WEIGHT or REPS depending on the exercise's typical rep range (a
// high-rep/bodyweight exercise gets a reps target instead of a weight target). Three ambition
// tiers (Konservativ/Realistisch/Ambitioniert) let the user pick how aggressive a timeline to
// commit to, rather than a single take-it-or-leave-it suggestion.
export const goalSuggestionDtoSchema = z.object({
  exerciseId: z.string().uuid(),
  exerciseName: z.string(),
  type: goalTypeSchema,
  currentBestValue: z.number(),
  // Best of the last 3 sessions hasn't beaten the best of everything before that — surfaced so
  // the UI can explain why the suggested increments are smaller than usual.
  plateauDetected: z.boolean(),
  tiers: z.object({
    conservative: goalSuggestionTierSchema,
    realistic: goalSuggestionTierSchema,
    ambitious: goalSuggestionTierSchema,
  }),
});
export type GoalSuggestionDto = z.infer<typeof goalSuggestionDtoSchema>;
