import type {
  ColdStartInput,
  GeneratePlanRequest,
  GeneratePlanResponse,
  PlanDraftDto,
  PlanDraftStateDto,
  PlanQuestionsResponse,
  PlanExerciseDto,
  TrainingPhase,
} from "@fitnesstracker/shared";
import { apiFetch } from "./client";

export function generatePlanRequest(input: GeneratePlanRequest) {
  return apiFetch<GeneratePlanResponse>("/ai/generate-plan", { method: "POST", body: input });
}

export function fetchPlanPreferences() {
  return apiFetch<{ preferences: ColdStartInput | null }>("/ai/preferences");
}

export function fetchPlanDraftState(phase: TrainingPhase) {
  return apiFetch<PlanDraftStateDto>(`/ai/plan-draft?phase=${phase}`);
}

export function discardPlanDraftRequest(phase: TrainingPhase) {
  return apiFetch<void>(`/ai/plan-draft?phase=${phase}`, { method: "DELETE" });
}

export function acceptPlanDraftRequest(phase: TrainingPhase) {
  return apiFetch<{ items: PlanExerciseDto[] }>("/ai/plan-draft/accept", { method: "POST", body: { phase } });
}

export function restorePlanBackupRequest(phase: TrainingPhase) {
  return apiFetch<{ items: PlanExerciseDto[] }>("/ai/plan-backup/restore", { method: "POST", body: { phase } });
}

export function replaceDraftItemRequest(phase: TrainingPhase, index: number, exerciseId: string) {
  return apiFetch<{ draft: PlanDraftDto }>("/ai/plan-draft/replace-item", {
    method: "POST",
    body: { phase, index, exerciseId },
  });
}

export function planQuestionsRequest(coldStart: ColdStartInput) {
  return apiFetch<PlanQuestionsResponse>("/ai/plan-questions", { method: "POST", body: { coldStart } });
}
