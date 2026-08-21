import type { Exercise, PlanExercise } from "@prisma/client";
import type { PlanExerciseDto } from "@fitnesstracker/shared";

export function toPlanExerciseDto(entry: PlanExercise & { exercise: Exercise }): PlanExerciseDto {
  return {
    id: entry.id,
    phase: entry.phase,
    exerciseId: entry.exerciseId,
    exerciseName: entry.exercise.name,
    targetSets: entry.targetSets,
    targetReps: entry.targetReps,
    order: entry.order,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
