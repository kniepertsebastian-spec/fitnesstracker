import type {
  DailyStretchDto,
  StretchChoice,
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

export function getDailyStretchRequest(choice: StretchChoice, shuffle = 0) {
  const params = new URLSearchParams({ focus: choice });
  if (shuffle > 0) params.set("shuffle", String(shuffle));
  return apiFetch<DailyStretchDto>(`/stretching/daily?${params.toString()}`);
}
