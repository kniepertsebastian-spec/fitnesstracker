import type {
  CreateWorkoutLogInput,
  UpdateWorkoutLogInput,
  WorkoutLogDto,
  WorkoutLogListDto,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

// Without `updatedSince`: the whole history; with it: only what changed since (delta sync).
export function listWorkoutLogsRequest(updatedSince?: string) {
  const query = updatedSince ? `?updatedSince=${encodeURIComponent(updatedSince)}` : "";
  return apiFetch<WorkoutLogListDto>(`/workout-logs${query}`);
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
