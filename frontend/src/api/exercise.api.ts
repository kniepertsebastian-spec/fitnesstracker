import type { ExerciseDto, ExerciseFacetsDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export interface ListExercisesParams {
  search?: string;
  muscleGroup?: string;
  equipment?: string;
  page?: number;
  pageSize?: number;
}

export function listExercisesRequest(params: ListExercisesParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.muscleGroup) query.set("muscleGroup", params.muscleGroup);
  if (params.equipment) query.set("equipment", params.equipment);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  return apiFetch<{ items: ExerciseDto[]; total: number }>(`/exercises${qs ? `?${qs}` : ""}`);
}

export function getExerciseByIdRequest(id: string) {
  return apiFetch<ExerciseDto>(`/exercises/${id}`);
}

export function getExerciseFacetsRequest() {
  return apiFetch<ExerciseFacetsDto>("/exercises/facets");
}
