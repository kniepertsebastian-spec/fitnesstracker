import type {
  CardioPlanDto,
  ResetCardioPlanInput,
  SaveCardioPlanDayInput,
  SaveCardioPlanFreeInput,
  TrainingPhase,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getCardioPlanRequest(phase?: TrainingPhase) {
  return apiFetch<CardioPlanDto>(`/cardio/plan${phase ? `?phase=${phase}` : ""}`);
}

export function saveCardioPlanDayRequest(input: SaveCardioPlanDayInput) {
  return apiFetch<CardioPlanDto>("/cardio/plan/day", { method: "PUT", body: input });
}

export function saveCardioPlanFreeRequest(input: SaveCardioPlanFreeInput) {
  return apiFetch<CardioPlanDto>("/cardio/plan/free", { method: "PUT", body: input });
}

export function resetCardioPlanRequest(input: ResetCardioPlanInput) {
  return apiFetch<CardioPlanDto>("/cardio/plan/reset", { method: "POST", body: input });
}
