import type { Goal, PrismaClient } from "@prisma/client";
import type { CreateGoalInput, UpdateGoalInput } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";
import { getLatestWeightKg } from "../bodyComposition/bodyComposition.service.js";

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

// Progress this app can derive automatically, per goal type. WEIGHT/REPS use the best value
// logged for the goal's exercise; BODYWEIGHT uses the most recent body-composition weigh-in
// (added in Phase 11 — before that, this branch didn't exist because there was nothing to
// compare against). CUSTOM still has no derivable source, so "achieved" stays a manual toggle.
export async function computeCurrentValue(
  prisma: PrismaClient,
  userId: string,
  goal: Goal,
): Promise<number | null> {
  if (goal.type === "BODYWEIGHT") {
    return getLatestWeightKg(prisma, userId);
  }

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
