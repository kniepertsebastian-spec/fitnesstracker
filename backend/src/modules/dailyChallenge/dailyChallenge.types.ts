import type { DailyChallengeItem, Exercise } from "@prisma/client";
import type { DailyChallengeItemDto } from "@fitnesstracker/shared";
import { MAX_ROTATIONS } from "./dailyChallenge.service.js";

type ItemWithExercise = DailyChallengeItem & { exercise: Exercise };

export function toDailyChallengeItemDto(item: ItemWithExercise): DailyChallengeItemDto {
  return {
    id: item.id,
    exerciseId: item.exerciseId,
    exerciseName: item.exercise.nameDe ?? item.exercise.name,
    category: item.category,
    targetReps: item.targetReps,
    completedReps: item.completedReps,
    rotationsRemaining: Math.max(0, MAX_ROTATIONS - item.rotationsUsed),
  };
}
