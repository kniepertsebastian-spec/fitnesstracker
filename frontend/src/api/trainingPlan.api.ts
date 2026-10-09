import type { TrainingPlanDto, UpdateTrainingGoalInput, UpdateTrainingPlanRemarksInput } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getTrainingPlanRequest() {
  return apiFetch<TrainingPlanDto>("/training-plan");
}

export function pauseTrainingPlanRequest() {
  return apiFetch<TrainingPlanDto>("/training-plan/pause", { method: "POST" });
}

export function resumeTrainingPlanRequest() {
  return apiFetch<TrainingPlanDto>("/training-plan/resume", { method: "POST" });
}

export function restartPhaseRequest() {
  return apiFetch<TrainingPlanDto>("/training-plan/restart-phase", { method: "POST" });
}

export function extendPhaseRequest() {
  return apiFetch<TrainingPlanDto>("/training-plan/extend-phase", { method: "POST" });
}

export function updateTrainingPlanRemarksRequest(input: UpdateTrainingPlanRemarksInput) {
  return apiFetch<TrainingPlanDto>("/training-plan/remarks", { method: "PATCH", body: input });
}

export function updateTrainingGoalRequest(input: UpdateTrainingGoalInput) {
  return apiFetch<TrainingPlanDto>("/training-plan/goal", { method: "PATCH", body: input });
}
