import type { PrismaClient } from "@prisma/client";
import type { CreateWorkoutLogInput, UpdateWorkoutLogInput } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";

const withExercise = { include: { exercise: true } } as const;

export function listWorkoutLogs(
  prisma: PrismaClient,
  userId: string,
  filters: { from?: string; to?: string; exerciseId?: string },
) {
  return prisma.workoutLog.findMany({
    where: {
      userId,
      deletedAt: null,
      exerciseId: filters.exerciseId,
      performedAt: {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      },
    },
    orderBy: { performedAt: "desc" },
    ...withExercise,
  });
}

// Idempotent by clientId: a retried submit (e.g. from a flaky connection, or later the offline
// sync queue) returns the existing row instead of throwing a unique-constraint error.
export function createWorkoutLog(prisma: PrismaClient, userId: string, input: CreateWorkoutLogInput) {
  return prisma.workoutLog.upsert({
    where: { clientId: input.clientId },
    update: {},
    create: {
      clientId: input.clientId,
      userId,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      rir: input.rir,
      supersetGroupId: input.supersetGroupId,
      performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
    },
    ...withExercise,
  });
}

// `idOrClientId` accepts either identifier: the offline sync queue only ever knows a row's
// clientId (it may not have synced yet and gotten a server `id` at all), while any other caller
// uses the server id. Both are UUIDs so the route's param validation doesn't need to change.
async function findOwnedWorkoutLog(prisma: PrismaClient, userId: string, idOrClientId: string) {
  const existing = await prisma.workoutLog.findFirst({
    where: { userId, deletedAt: null, OR: [{ id: idOrClientId }, { clientId: idOrClientId }] },
  });
  if (!existing) {
    throw new NotFoundError("Workout log not found");
  }
  return existing;
}

export async function updateWorkoutLog(
  prisma: PrismaClient,
  userId: string,
  idOrClientId: string,
  input: UpdateWorkoutLogInput,
) {
  const existing = await findOwnedWorkoutLog(prisma, userId, idOrClientId);

  return prisma.workoutLog.update({
    where: { id: existing.id },
    data: {
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      rir: input.rir,
      supersetGroupId: input.supersetGroupId,
      performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
    },
    ...withExercise,
  });
}

export async function deleteWorkoutLog(prisma: PrismaClient, userId: string, idOrClientId: string) {
  const existing = await findOwnedWorkoutLog(prisma, userId, idOrClientId);
  await prisma.workoutLog.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
}
