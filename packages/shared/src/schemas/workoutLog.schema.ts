import { z } from "zod";

export const createWorkoutLogSchema = z.object({
  clientId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  performedAt: z.string().datetime().optional(),
});
export type CreateWorkoutLogInput = z.infer<typeof createWorkoutLogSchema>;

export const updateWorkoutLogSchema = z.object({
  exerciseId: z.string().uuid().optional(),
  setNumber: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  weightKg: z.number().nonnegative().optional(),
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
  performedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutLogDto = z.infer<typeof workoutLogDtoSchema>;
