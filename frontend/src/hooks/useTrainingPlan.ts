import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTrainingPlanRequest,
  pauseTrainingPlanRequest,
  restartPhaseRequest,
  resumeTrainingPlanRequest,
} from "../api/trainingPlan.api";

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
