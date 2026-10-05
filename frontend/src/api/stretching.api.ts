import type {
  DailyStretchDto,
  StretchFocusMuscle,
  StretchPlanDto,
  TrainingPhase,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getStretchPlanRequest(phase?: TrainingPhase) {
  return apiFetch<StretchPlanDto>(`/stretching/plan${phase ? `?phase=${phase}` : ""}`);
}

export function generateStretchPlanRequest(phase: TrainingPhase) {
  return apiFetch<StretchPlanDto>("/stretching/plan/generate", { method: "POST", body: { phase } });
}

export function resetStretchPlanRequest(phase: TrainingPhase) {
  return apiFetch<void>(`/stretching/plan?phase=${phase}`, { method: "DELETE" });
}

export function getDailyStretchRequest(focus: StretchFocusMuscle | null) {
  return apiFetch<DailyStretchDto>(`/stretching/daily${focus ? `?focus=${encodeURIComponent(focus)}` : ""}`);
}
