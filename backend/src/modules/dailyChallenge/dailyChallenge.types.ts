import type { DailyChallengeItem, Exercise } from "@prisma/client";
import type { DailyChallengeItemDto } from "@fitnesstracker/shared";

type ItemWithExercise = DailyChallengeItem & { exercise: Exercise };

export function toDailyChallengeItemDto(item: ItemWithExercise): DailyChallengeItemDto {
  return {
    id: item.id,
    exerciseId: item.exerciseId,
    exerciseName: item.exercise.nameDe ?? item.exercise.name,
    targetReps: item.targetReps,
    completedReps: item.completedReps,
  };
}
