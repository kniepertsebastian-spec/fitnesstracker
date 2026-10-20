import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GeneratePlanRequest, TrainingPhase } from "@fitnesstracker/shared";
import {
  acceptPlanDraftRequest,
  discardPlanDraftRequest,
  fetchPlanDraftState,
  fetchPlanPreferences,
  generatePlanRequest,
  restorePlanBackupRequest,
} from "../api/aiPlanGenerator.api";

const draftKey = (phase: TrainingPhase) => ["ai-plan-draft", phase] as const;

export function usePlanPreferences() {
  return useQuery({ queryKey: ["ai-plan-preferences"], queryFn: fetchPlanPreferences });
}

export function usePlanDraftState(phase: TrainingPhase) {
  return useQuery({ queryKey: draftKey(phase), queryFn: () => fetchPlanDraftState(phase) });
}

export function useGeneratePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePlanRequest) => generatePlanRequest(input),
    onSuccess: (result, variables) => {
      if (result.status === "draft") {
        queryClient.setQueryData(draftKey(variables.phase), (current: { hasBackup: boolean } | undefined) => ({
          draft: result.draft,
          hasBackup: current?.hasBackup ?? false,
        }));
      }
      if (result.status === "draft") {
        for (const other of result.otherDrafts ?? []) {
          queryClient.setQueryData(draftKey(other.phase), (current: { hasBackup: boolean } | undefined) => ({
            draft: other,
            hasBackup: current?.hasBackup ?? false,
          }));
        }
      }
      if (variables.coldStart) queryClient.invalidateQueries({ queryKey: ["ai-plan-preferences"] });
    },
  });
}

// Accepting or restoring rewrites the live plan, so every plan view refetches.
function invalidatePlan(queryClient: ReturnType<typeof useQueryClient>, phase: TrainingPhase) {
  queryClient.invalidateQueries({ queryKey: draftKey(phase) });
  queryClient.invalidateQueries({ queryKey: ["plan-exercises", phase] });
  queryClient.invalidateQueries({ queryKey: ["plan-exercises", "week-status", phase] });
  queryClient.invalidateQueries({ queryKey: ["stretching"] });
  queryClient.invalidateQueries({ queryKey: ["cardio"] });
}

export function useAcceptPlanDraft(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => acceptPlanDraftRequest(phase),
    onSuccess: () => invalidatePlan(queryClient, phase),
  });
}

export function useDiscardPlanDraft(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => discardPlanDraftRequest(phase),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: draftKey(phase) }),
  });
}

export function useRestorePlanBackup(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => restorePlanBackupRequest(phase),
    onSuccess: () => invalidatePlan(queryClient, phase),
  });
}
