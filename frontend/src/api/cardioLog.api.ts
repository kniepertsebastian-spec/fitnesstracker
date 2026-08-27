import type { CardioLogDto, CreateCardioLogInput } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function listTodayCardioLogsRequest() {
  return apiFetch<{ items: CardioLogDto[] }>("/cardio-logs");
}

export function createCardioLogRequest(input: CreateCardioLogInput) {
  return apiFetch<CardioLogDto>("/cardio-logs", { method: "POST", body: input });
}

export function deleteCardioLogRequest(id: string) {
  return apiFetch<void>(`/cardio-logs/${id}`, { method: "DELETE" });
}
