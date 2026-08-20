import type {
  BodyCompositionEntryDto,
  CreateBodyCompositionEntryInput,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function listBodyCompositionEntriesRequest() {
  return apiFetch<{ items: BodyCompositionEntryDto[] }>("/body-composition");
}

export function createBodyCompositionEntryRequest(input: CreateBodyCompositionEntryInput) {
  return apiFetch<BodyCompositionEntryDto>("/body-composition", { method: "POST", body: input });
}

export function deleteBodyCompositionEntryRequest(id: string) {
  return apiFetch<void>(`/body-composition/${id}`, { method: "DELETE" });
}
