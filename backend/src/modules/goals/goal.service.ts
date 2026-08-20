import type { Goal, PrismaClient } from "@prisma/client";
import type { CreateGoalInput, UpdateGoalInput } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";

const withExercise = { include: { exercise: true } } as const;

export function listGoals(prisma: PrismaClient, userId: string) {
  return prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, ...withExercise });
}

export async function createGoal(prisma: PrismaClient, userId: string, input: CreateGoalInput) {
  if (input.exerciseId) {
    const exercise = await prisma.exercise.findUnique({ where: { id: input.exerciseId } });
    if (!exercise) {
      throw new NotFoundError("Exercise not found");
    }
  }

  return prisma.goal.create({
    data: {
      userId,
      type: input.type,
      exerciseId: input.exerciseId,
      targetValue: input.targetValue,
      targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
    },
    ...withExercise,
  });
}

export async function updateGoal(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: UpdateGoalInput,
) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Goal not found");
  }

  return prisma.goal.update({
    where: { id },
    data: {
      targetValue: input.targetValue,
      targetDate:
        input.targetDate === undefined ? undefined : input.targetDate ? new Date(input.targetDate) : null,
      achievedAt:
        input.achievedAt === undefined ? undefined : input.achievedAt ? new Date(input.achievedAt) : null,
    },
    ...withExercise,
  });
}

export async function deleteGoal(prisma: PrismaClient, userId: string, id: string) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new NotFoundError("Goal not found");
  }
  await prisma.goal.delete({ where: { id } });
}

// Best value logged so far for the goal's exercise — the only kind of progress this app can
// derive automatically, since there's no bodyweight log to compare BODYWEIGHT/CUSTOM goals
// against. Returns null wherever there's nothing to compute from.
export async function computeCurrentValue(
  prisma: PrismaClient,
  userId: string,
  goal: Goal,
): Promise<number | null> {
  if (!goal.exerciseId || (goal.type !== "WEIGHT" && goal.type !== "REPS")) {
    return null;
  }

  const where = { userId, exerciseId: goal.exerciseId, deletedAt: null };
  if (goal.type === "WEIGHT") {
    const result = await prisma.workoutLog.aggregate({ where, _max: { weightKg: true } });
    return result._max.weightKg === null ? null : Number(result._max.weightKg);
  }

  const result = await prisma.workoutLog.aggregate({ where, _max: { reps: true } });
  return result._max.reps;
}
