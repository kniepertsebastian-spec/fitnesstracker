import type {
  BodyCompositionEntryDto,
  CreateBodyCompositionEntryInput,
  ImportBodyCompositionInput,
  ImportBodyCompositionResult,
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

export function importBodyCompositionRequest(input: ImportBodyCompositionInput) {
  return apiFetch<ImportBodyCompositionResult>("/body-composition/import", { method: "POST", body: input });
}
