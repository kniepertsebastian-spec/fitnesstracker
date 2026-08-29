import type { DailyChallengeItemDto } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function getDailyChallengeRequest() {
  return apiFetch<{ items: DailyChallengeItemDto[] }>("/daily-challenge");
}

export function addChallengeRepsRequest(itemId: string, delta: number) {
  return apiFetch<DailyChallengeItemDto>(`/daily-challenge/${itemId}/reps`, {
    method: "POST",
    body: { delta },
  });
}

export function rerollChallengeItemRequest(itemId: string) {
  return apiFetch<DailyChallengeItemDto>(`/daily-challenge/${itemId}/reroll`, { method: "POST" });
}
