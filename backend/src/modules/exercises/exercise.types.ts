import type { Exercise } from "@prisma/client";
import type { ExerciseDto } from "@fitnesstracker/shared";

export function toExerciseDto(exercise: Exercise): ExerciseDto {
  return {
    id: exercise.id,
    name: exercise.nameDe ?? exercise.name,
    description: exercise.description,
    videoUrl: exercise.videoUrl,
    imageUrls: exercise.imageUrls,
    equipment: exercise.equipment,
    category: exercise.category,
    primaryMuscles: exercise.primaryMuscles,
    secondaryMuscles: exercise.secondaryMuscles,
    source: exercise.source,
  };
}
