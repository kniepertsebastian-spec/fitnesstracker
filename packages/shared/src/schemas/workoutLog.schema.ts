import { z } from "zod";

// RIR (Reps In Reserve): 0 = trained to failure. Capped at 10 — a generous upper bound, not a
// clinical limit, just enough to reject obvious garbage input.
const rirSchema = z.number().int().min(0).max(10).nullable().optional();

export const createWorkoutLogSchema = z.object({
  clientId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  rir: rirSchema,
  // Client-generated, shared by every set logged as one superset/drop-set round — see
  // WorkoutLog.supersetGroupId in schema.prisma.
  supersetGroupId: z.string().uuid().nullable().optional(),
  performedAt: z.string().datetime().optional(),
});
export type CreateWorkoutLogInput = z.infer<typeof createWorkoutLogSchema>;

export const updateWorkoutLogSchema = z.object({
  exerciseId: z.string().uuid().optional(),
  setNumber: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  weightKg: z.number().nonnegative().optional(),
  rir: rirSchema,
  supersetGroupId: z.string().uuid().nullable().optional(),
  performedAt: z.string().datetime().optional(),
});
export type UpdateWorkoutLogInput = z.infer<typeof updateWorkoutLogSchema>;

export const workoutLogDtoSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  exerciseName: z.string(),
  setNumber: z.number().int(),
  reps: z.number().int(),
  weightKg: z.number(),
  rir: z.number().int().nullable(),
  supersetGroupId: z.string().uuid().nullable(),
  performedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutLogDto = z.infer<typeof workoutLogDtoSchema>;
