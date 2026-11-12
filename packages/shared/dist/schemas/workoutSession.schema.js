import { z } from "zod";
export const workoutSessionStatusSchema = z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ABORTED"]);
export const createWorkoutSessionSchema = z.object({
    clientId: z.string().uuid(),
});
// Only a status transition is ever pushed from the client (Pause/Fortsetzen/Abbrechen/
// Abschließen) — startedAt is set once at creation, endedAt is derived server-side from the
// status, neither is ever sent directly.
export const updateWorkoutSessionSchema = z.object({
    status: workoutSessionStatusSchema,
});
export const workoutSessionDtoSchema = z.object({
    id: z.string().uuid(),
    clientId: z.string().uuid(),
    status: workoutSessionStatusSchema,
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime().nullable(),
    // Set while the "Training noch aktiv?" prompt is open (see forgottenSession.ts on the backend).
    stopPromptSentAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
//# sourceMappingURL=workoutSession.schema.js.map