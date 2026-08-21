import type { PrismaClient, TrainingPhase } from "@prisma/client";
import type { CreatePlanExerciseInput, UpdatePlanExerciseInput } from "@fitnesstracker/shared";
import { ConflictError, NotFoundError } from "../../errors/httpErrors.js";

const withExercise = { include: { exercise: true } } as const;

export function listPlanExercises(prisma: PrismaClient, userId: string, phase: TrainingPhase) {
  return prisma.planExercise.findMany({
    where: { userId, phase },
    orderBy: { order: "asc" },
    ...withExercise,
  });
}

export async function createPlanExercise(
  prisma: PrismaClient,
  userId: string,
  input: CreatePlanExerciseInput,
) {
  const exercise = await prisma.exercise.findUnique({ where: { id: input.exerciseId } });
  if (!exercise) {
    throw new NotFoundError("Exercise not found");
  }

  const existing = await prisma.planExercise.findUnique({
    where: { userId_phase_exerciseId: { userId, phase: input.phase, exerciseId: input.exerciseId } },
  });
  if (existing) {
    throw new ConflictError("Exercise already assigned to this phase");
  }

  const last = await prisma.planExercise.findFirst({
    where: { userId, phase: input.phase },
    orderBy: { order: "desc" },
  });

  return prisma.planExercise.create({
    data: {
      userId,
      phase: input.phase,
      exerciseId: input.exerciseId,
      targetSets: input.targetSets,
      targetReps: input.targetReps,
      order: last ? last.order + 1 : 0,
    },
    ...withExercise,
  });
}

export async function updatePlanExercise(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdatePlanExerciseInput,
) {
  const existing = await prisma.planExercise.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Plan exercise not found");
  }

  return prisma.planExercise.update({
    where: { id },
    data: {
      targetSets: input.targetSets,
      targetReps: input.targetReps,
      order: input.order,
    },
    ...withExercise,
  });
}

export async function deletePlanExercise(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.planExercise.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Plan exercise not found");
  }
  await prisma.planExercise.delete({ where: { id } });
}
