import type {
  AnalyzeSupplementInput,
  CreateSupplementInput,
  SupplementAnalysisDto,
  SupplementDto,
  UpdateSupplementInput,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function listSupplementsRequest() {
  return apiFetch<{ items: SupplementDto[] }>("/supplements");
}

export function createSupplementRequest(input: CreateSupplementInput) {
  return apiFetch<SupplementDto>("/supplements", { method: "POST", body: input });
}

export function updateSupplementRequest(id: string, input: UpdateSupplementInput) {
  return apiFetch<SupplementDto>(`/supplements/${id}`, { method: "PATCH", body: input });
}

export function deleteSupplementRequest(id: string) {
  return apiFetch<void>(`/supplements/${id}`, { method: "DELETE" });
}

export function analyzeSupplementRequest(input: AnalyzeSupplementInput) {
  return apiFetch<SupplementAnalysisDto>("/supplements/analyze", { method: "POST", body: input });
}
