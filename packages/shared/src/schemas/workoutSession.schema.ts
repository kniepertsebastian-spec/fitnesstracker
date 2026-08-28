import { z } from "zod";

export const workoutSessionStatusSchema = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ABORTED"]);
export type WorkoutSessionStatus = z.infer<typeof workoutSessionStatusSchema>;

export const createWorkoutSessionSchema = z.object({
  clientId: z.string().uuid(),
});
export type CreateWorkoutSessionInput = z.infer<typeof createWorkoutSessionSchema>;

// Only a status transition is ever pushed from the client (Pause/Fortsetzen/Abbrechen/
// Abschließen) — startedAt is set once at creation, endedAt is derived server-side from the
// status, neither is ever sent directly.
export const updateWorkoutSessionSchema = z.object({
  status: workoutSessionStatusSchema,
});
export type UpdateWorkoutSessionInput = z.infer<typeof updateWorkoutSessionSchema>;

export const workoutSessionDtoSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  status: workoutSessionStatusSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutSessionDto = z.infer<typeof workoutSessionDtoSchema>;
