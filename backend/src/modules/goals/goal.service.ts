import type { Exercise, Goal, PrismaClient } from "@prisma/client";
import type { CreateGoalInput, UpdateGoalInput } from "@fitnesstracker/shared";
import { NotFoundError } from "../../errors/httpErrors.js";
import { getLatestWeightKg } from "../bodyComposition/bodyComposition.service.js";
import { sendNotificationToUser } from "../push/push.service.js";

const withExercise = { include: { exercise: true } } as const;

type GoalWithExercise = Goal & { exercise: Exercise | null };

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

// Auto-flips a goal to achieved the moment its derived current value first reaches the target —
// without this, `achievedAt` only ever moved on an explicit "Als erreicht markieren" tap, so a
// goal could sit at or past 100% indefinitely with no acknowledgment. Deliberately one-way: once
// set, a later dip back below target never un-achieves it (this can't actually happen for
// WEIGHT/REPS anyway, since they're a running max).
//
// Restricted to WEIGHT/REPS — "higher is progress" only holds unambiguously for those two.
// BODYWEIGHT has no fixed direction (a target could mean "lose weight to X" or "bulk up to X",
// and nothing in the data says which the user meant), so `currentValue >= targetValue` isn't a
// reliable achieved-check for it — a cut goal of "75kg" would wrongly auto-achieve for someone
// who currently weighs *more* than that and hasn't lost anything yet. CUSTOM has no derivable
// currentValue at all (see computeCurrentValue). Both stay manual-only, same as before this change.
export async function autoAchieveIfDue(
  prisma: PrismaClient,
  goal: GoalWithExercise,
  currentValue: number | null,
) {
  if (goal.achievedAt || currentValue === null) {
    return goal;
  }
  if (goal.type !== "WEIGHT" && goal.type !== "REPS") {
    return goal;
  }
  if (currentValue < Number(goal.targetValue)) {
    return goal;
  }
  const updated = await prisma.goal.update({
    where: { id: goal.id },
    data: { achievedAt: new Date() },
    ...withExercise,
  });
  // Only the auto-detected path notifies — a user who just tapped "Als erreicht markieren"
  // themselves already knows, so a push about their own just-performed action would be the
  // "aufdringlich" pattern the roadmap explicitly wants avoided. This path is the genuinely
  // newsworthy one: the system noticed a crossed threshold the user might not have checked for.
  const user = await prisma.user.findUnique({ where: { id: goal.userId }, select: { remindGoalAchievements: true } });
  if (user?.remindGoalAchievements) {
    const goalName = updated.exercise ? (updated.exercise.nameDe ?? updated.exercise.name) : "Körpergewicht";
    await sendNotificationToUser(prisma, goal.userId, {
      title: "🎯 Ziel erreicht",
      body: `${goalName} — ${Number(updated.targetValue)} erreicht`,
      url: "/goals",
    });
  }
  return updated;
}
