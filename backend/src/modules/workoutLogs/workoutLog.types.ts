import type { WorkoutLog, Exercise } from "@prisma/client";
import type { WorkoutLogDto } from "@fitnesstracker/shared";

type WorkoutLogWithExercise = WorkoutLog & { exercise: Exercise };

export function toWorkoutLogDto(log: WorkoutLogWithExercise): WorkoutLogDto {
  return {
    id: log.id,
    clientId: log.clientId,
    exerciseId: log.exerciseId,
    exerciseName: log.exercise.nameDe ?? log.exercise.name,
    setNumber: log.setNumber,
    reps: log.reps,
    // Prisma.Decimal doesn't serialize to a plain JSON number on its own — convert explicitly.
    weightKg: Number(log.weightKg),
    performedAt: log.performedAt.toISOString(),
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
  };
}
