import type { CreateGoalInput, GoalDto, GoalSuggestionDto, UpdateGoalInput } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function listGoalsRequest() {
  return apiFetch<{ items: GoalDto[] }>("/goals");
}

export function listGoalSuggestionsRequest() {
  return apiFetch<{ items: GoalSuggestionDto[] }>("/goals/suggestions");
}

export function createGoalRequest(input: CreateGoalInput) {
  return apiFetch<GoalDto>("/goals", { method: "POST", body: input });
}

export function updateGoalRequest(id: string, input: UpdateGoalInput) {
  return apiFetch<GoalDto>(`/goals/${id}`, { method: "PATCH", body: input });
}

export function deleteGoalRequest(id: string) {
  return apiFetch<void>(`/goals/${id}`, { method: "DELETE" });
}
