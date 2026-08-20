import type { CreateWorkoutLogInput, UpdateWorkoutLogInput, WorkoutLogDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function listWorkoutLogsRequest() {
  return apiFetch<{ items: WorkoutLogDto[] }>("/workout-logs");
}

export function createWorkoutLogRequest(input: CreateWorkoutLogInput) {
  return apiFetch<WorkoutLogDto>("/workout-logs", { method: "POST", body: input });
}

export function updateWorkoutLogRequest(id: string, input: UpdateWorkoutLogInput) {
  return apiFetch<WorkoutLogDto>(`/workout-logs/${id}`, { method: "PATCH", body: input });
}

export function deleteWorkoutLogRequest(id: string) {
  return apiFetch<void>(`/workout-logs/${id}`, { method: "DELETE" });
}
