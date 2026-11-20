import { z } from "zod";

export const workoutSessionStatusSchema = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ABORTED"]);
export type WorkoutSessionStatus = z.infer<typeof workoutSessionStatusSchema>;

// TRAINING = the regular workout, DAILY = the Daily phase done in pieces over the day (see schema.prisma).
export const workoutSessionKindSchema = z.enum(["TRAINING", "DAILY"]);
export type WorkoutSessionKind = z.infer<typeof workoutSessionKindSchema>;

export const createWorkoutSessionSchema = z.object({
  clientId: z.string().uuid(),
  // Absent = TRAINING (requests queued by an older client).
  kind: workoutSessionKindSchema.optional(),
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
  kind: workoutSessionKindSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  // Set while the "Training noch aktiv?" prompt is open (see forgottenSession.ts on the backend).
  stopPromptSentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutSessionDto = z.infer<typeof workoutSessionDtoSchema>;
