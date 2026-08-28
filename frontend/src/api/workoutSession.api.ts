import type {
  CreateWorkoutSessionInput,
  UpdateWorkoutSessionInput,
  WorkoutSessionDto,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getOpenWorkoutSessionRequest() {
  return apiFetch<WorkoutSessionDto | null>("/workout-sessions/open");
}

export function createWorkoutSessionRequest(input: CreateWorkoutSessionInput) {
  return apiFetch<WorkoutSessionDto>("/workout-sessions", { method: "POST", body: input });
}

export function updateWorkoutSessionRequest(id: string, input: UpdateWorkoutSessionInput) {
  return apiFetch<WorkoutSessionDto>(`/workout-sessions/${id}`, { method: "PATCH", body: input });
}
