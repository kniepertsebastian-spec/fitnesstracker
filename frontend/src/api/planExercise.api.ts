import type {
  CreatePlanExerciseInput,
  PlanExerciseDto,
  TrainingPhase,
  UpdatePlanExerciseInput,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function listPlanExercisesRequest(phase: TrainingPhase) {
  return apiFetch<{ items: PlanExerciseDto[] }>(`/plan-exercises?phase=${phase}`);
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
