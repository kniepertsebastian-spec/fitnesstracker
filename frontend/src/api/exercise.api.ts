import type {
  CreateExerciseInput,
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
