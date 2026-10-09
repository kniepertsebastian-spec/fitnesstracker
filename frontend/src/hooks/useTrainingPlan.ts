import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  extendPhaseRequest,
  getTrainingPlanRequest,
  pauseTrainingPlanRequest,
  restartPhaseRequest,
  resumeTrainingPlanRequest,
  updateTrainingGoalRequest,
  updateTrainingPlanRemarksRequest,
} from "../api/trainingPlan.api";
import type { TrainingGoalValue, UpdateTrainingPlanRemarksInput } from "@fitnesstracker/shared";

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

// "+1 Woche": pushes the next phase change out by a week (online-only, like pausing).
export function useExtendPhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: extendPhaseRequest,
    onSuccess: (plan) => queryClient.setQueryData(TRAINING_PLAN_KEY, plan),
  });
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

// F9: the goal changes the cardio suggestion, so the cardio plans of every phase are refetched.
export function useSetTrainingGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goal: TrainingGoalValue | null) => updateTrainingGoalRequest({ goal }),
    onSuccess: (plan) => {
      queryClient.setQueryData(TRAINING_PLAN_KEY, plan);
      void queryClient.invalidateQueries({ queryKey: ["cardio", "plan"] });
    },
  });
}
