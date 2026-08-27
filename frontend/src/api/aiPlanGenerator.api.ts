import type { GeneratePlanRequest, GeneratePlanResponse } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function generatePlanRequest(input: GeneratePlanRequest) {
  return apiFetch<GeneratePlanResponse>("/ai/generate-plan", { method: "POST", body: input });
}
