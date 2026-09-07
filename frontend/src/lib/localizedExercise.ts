import type { ExerciseDto } from "@fitnesstracker/shared";
import type { AppLanguage } from "../i18n";

export function localizedExerciseName(exercise: ExerciseDto, language: AppLanguage) {
  return language === "de" ? exercise.nameDe ?? exercise.nameEn : exercise.nameEn;
}

export function localizedExerciseDescription(exercise: ExerciseDto, language: AppLanguage) {
  return language === "de"
    ? exercise.descriptionDe ?? exercise.descriptionEn
    : exercise.descriptionEn;
}
