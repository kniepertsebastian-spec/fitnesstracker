import type {
  CreatePlanExerciseInput,
  ExerciseOptionDto,
  PlanExerciseDto,
  PlanExportFormat,
  PlanImportMode,
  PlanImportPreview,
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

export function exportPlanExercisesRequest(format: PlanExportFormat, phase?: TrainingPhase) {
  return apiFetchBlob(`/plan-exercises/export?format=${format}${phase ? `&phase=${phase}` : ""}`);
}

export function previewPlanImportRequest(file: File, format: PlanExportFormat) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<PlanImportPreview>(`/plan-exercises/import/preview?format=${format}`, formData);
}

export interface PlanImportOptions {
  sourcePhase?: TrainingPhase;
  targetPhase?: TrainingPhase;
  mode?: PlanImportMode;
}

export function importPlanExercisesRequest(file: File, format: PlanExportFormat, options: PlanImportOptions = {}) {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams({ format });
  if (options.sourcePhase) params.set("sourcePhase", options.sourcePhase);
  if (options.targetPhase) params.set("targetPhase", options.targetPhase);
  if (options.mode) params.set("mode", options.mode);
  return apiUpload<PlanImportResult>(`/plan-exercises/import?${params.toString()}`, formData);
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

export function listExerciseAlternativesRequest(exerciseId: string, excludeIds: string[] = []) {
  const params = new URLSearchParams({ exerciseId });
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  return apiFetch<{ items: ExerciseOptionDto[] }>(`/plan-exercises/alternatives?${params}`);
}
