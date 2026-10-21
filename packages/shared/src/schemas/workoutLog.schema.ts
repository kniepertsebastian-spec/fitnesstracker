import { z } from "zod";

// RIR (Reps In Reserve): 0 = trained to failure. Capped at 10 — a generous upper bound, not a
// clinical limit, just enough to reject obvious garbage input.
const rirSchema = z.number().int().min(0).max(10).nullable().optional();

// Free-text note on a set; empty text is stored as no note.
const noteSchema = z
  .string()
  .trim()
  .max(500)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createWorkoutLogSchema = z.object({
  clientId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().positive(),
  weightKg: z.number().nonnegative(),
  rir: rirSchema,
  note: noteSchema,
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
  note: noteSchema,
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
  note: z.string().nullable(),
  supersetGroupId: z.string().uuid().nullable(),
  performedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkoutLogDto = z.infer<typeof workoutLogDtoSchema>;

// GET /workout-logs. Without `updatedSince` it is the account's whole history; with it only what
// changed after that moment — `items` are rows to upsert, `deletedClientIds` the tombstones
// (deleted sets are soft-deleted and never purged, so a delta can always express a deletion).
// `serverTime` is the server's clock from before the query ran; the client sends it back
// (minus a small overlap) as the next `updatedSince`, so no clock of the device is involved.
export const workoutLogListDtoSchema = z.object({
  items: z.array(workoutLogDtoSchema),
  deletedClientIds: z.array(z.string().uuid()),
  serverTime: z.string().datetime(),
});
export type WorkoutLogListDto = z.infer<typeof workoutLogListDtoSchema>;
