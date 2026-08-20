import type { Exercise, Goal } from "@prisma/client";
import type { GoalDto } from "@fitnesstracker/shared";

type GoalWithExercise = Goal & { exercise: Exercise | null };

export function toGoalDto(goal: GoalWithExercise, currentValue: number | null): GoalDto {
  return {
    id: goal.id,
    type: goal.type,
    exerciseId: goal.exerciseId,
    exerciseName: goal.exercise?.name ?? null,
    // Prisma.Decimal doesn't serialize to a plain JSON number on its own — convert explicitly.
    targetValue: Number(goal.targetValue),
    targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
    achievedAt: goal.achievedAt ? goal.achievedAt.toISOString() : null,
    currentValue,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}
