import type {
  CreateExerciseInput,
  DescriptionTranslationState,
  ExerciseCatalogDto,
  ExerciseDto,
  ExerciseFacetsDto,
  UpdateExerciseInput,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export interface ListExercisesParams {
  search?: string;
  muscleGroup?: string;
  equipment?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export function listExercisesRequest(params: ListExercisesParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.muscleGroup) query.set("muscleGroup", params.muscleGroup);
  if (params.equipment) query.set("equipment", params.equipment);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.includeInactive) query.set("includeInactive", "true");

  const qs = query.toString();
  return apiFetch<{ items: ExerciseDto[]; total: number }>(`/exercises${qs ? `?${qs}` : ""}`);
}

// The whole catalog for the offline copy; with the last `version` the answer is just `unchanged`.
export function getExerciseCatalogRequest(version?: string) {
  return apiFetch<ExerciseCatalogDto>(`/exercises/catalog${version ? `?version=${encodeURIComponent(version)}` : ""}`);
}

export function getDescriptionTranslationRequest() {
  return apiFetch<DescriptionTranslationState & { isOperator: boolean }>("/exercises/translate-descriptions");
}

export function startDescriptionTranslationRequest() {
  return apiFetch<DescriptionTranslationState & { isOperator: boolean }>("/exercises/translate-descriptions", { method: "POST" });
}

export function getExerciseByIdRequest(id: string) {
  return apiFetch<ExerciseDto>(`/exercises/${id}`);
}

export function getExerciseFacetsRequest() {
  return apiFetch<ExerciseFacetsDto>("/exercises/facets");
}

export function createExerciseRequest(input: CreateExerciseInput) {
  return apiFetch<ExerciseDto>("/exercises", { method: "POST", body: input });
}

export function updateExerciseRequest(id: string, input: UpdateExerciseInput) {
  return apiFetch<ExerciseDto>(`/exercises/${id}`, { method: "PATCH", body: input });
}

export function deleteExerciseRequest(id: string) {
  return apiFetch<void>(`/exercises/${id}`, { method: "DELETE" });
}
