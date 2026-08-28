import type { TrainingPlanDto } from "@fitnesstracker/shared";
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
