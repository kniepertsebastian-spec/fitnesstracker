import type {
  CreatePlanExerciseInput,
  PlanExerciseDto,
  PlanExportFormat,
  PlanImportResult,
  TrainingPhase,
  UpdatePlanExerciseInput,
  WeeklyPlanStatusDto,
} from "@fitnesstracker/shared";
import { apiFetch, apiFetchBlob, apiUpload } from "./client";

export function listPlanExercisesRequest(phase: TrainingPhase) {
  return apiFetch<{ items: PlanExerciseDto[] }>(`/plan-exercises?phase=${phase}`);
}

export function getWeeklyPlanStatusRequest(phase: TrainingPhase) {
  return apiFetch<WeeklyPlanStatusDto>(`/plan-exercises/week-status?phase=${phase}`);
}

export function exportPlanExercisesRequest(format: PlanExportFormat) {
  return apiFetchBlob(`/plan-exercises/export?format=${format}`);
}

export function importPlanExercisesRequest(file: File, format: PlanExportFormat) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<PlanImportResult>(`/plan-exercises/import?format=${format}`, formData);
}

export function createPlanExerciseRequest(input: CreatePlanExerciseInput) {
  return apiFetch<PlanExerciseDto>("/plan-exercises", { method: "POST", body: input });
}

export function updatePlanExerciseRequest(id: string, input: UpdatePlanExerciseInput) {
  return apiFetch<PlanExerciseDto>(`/plan-exercises/${id}`, { method: "PATCH", body: input });
}

export function deletePlanExerciseRequest(id: string) {
  return apiFetch<void>(`/plan-exercises/${id}`, { method: "DELETE" });
}
