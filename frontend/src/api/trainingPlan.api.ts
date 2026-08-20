import type { TrainingPlanDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getTrainingPlanRequest() {
  return apiFetch<TrainingPlanDto>("/training-plan");
}
