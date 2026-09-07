import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTrainingPlanRequest,
  pauseTrainingPlanRequest,
  restartPhaseRequest,
  resumeTrainingPlanRequest,
  updateTrainingPlanRemarksRequest,
} from "../api/trainingPlan.api";
import type { UpdateTrainingPlanRemarksInput } from "@fitnesstracker/shared";

export { TRAINING_PHASE_LABELS } from "@fitnesstracker/shared";

const TRAINING_PLAN_KEY = ["training-plan"];

export function useTrainingPlan() {
  return useQuery({
    queryKey: TRAINING_PLAN_KEY,
    queryFn: getTrainingPlanRequest,
  });
}

function useTrainingPlanAction(action: () => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRAINING_PLAN_KEY }),
  });
}

export function usePauseTrainingPlan() {
  return useTrainingPlanAction(pauseTrainingPlanRequest);
}

export function useResumeTrainingPlan() {
  return useTrainingPlanAction(resumeTrainingPlanRequest);
}

export function useRestartPhase() {
  return useTrainingPlanAction(restartPhaseRequest);
}

export function useUpdateTrainingPlanRemarks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTrainingPlanRemarksInput) => updateTrainingPlanRemarksRequest(input),
    onSuccess: (plan) => queryClient.setQueryData(TRAINING_PLAN_KEY, plan),
  });
}
