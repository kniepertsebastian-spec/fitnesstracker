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
      performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
    },
    ...withExercise,
  });
}

export async function updateWorkoutLog(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateWorkoutLogInput,
) {
  const existing = await prisma.workoutLog.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) {
    throw new NotFoundError("Workout log not found");
  }

  return prisma.workoutLog.update({
    where: { id },
    data: {
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      reps: input.reps,
      weightKg: input.weightKg,
      performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
    },
    ...withExercise,
  });
}

export async function deleteWorkoutLog(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.workoutLog.findFirst({ where: { id, userId, deletedAt: null } });
  if (!existing) {
    throw new NotFoundError("Workout log not found");
  }

  await prisma.workoutLog.update({ where: { id }, data: { deletedAt: new Date() } });
}

export function listExercises(prisma: PrismaClient) {
  return prisma.exercise.findMany({ orderBy: { name: "asc" } });
}
