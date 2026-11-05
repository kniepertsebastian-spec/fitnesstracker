import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTrainingPhaseRequest,
  changeTrainingPhaseRequest,
  deleteTrainingPhaseRequest,
  extendPhaseRequest,
  getTrainingPlanRequest,
  pauseTrainingPlanRequest,
  renameTrainingPhaseRequest,
  restartPhaseRequest,
  resumeTrainingPlanRequest,
  updateTrainingGoalRequest,
  updateTrainingPlanRemarksRequest,
} from "../api/trainingPlan.api";
import type {
  AddTrainingPhaseInput,
  RenameTrainingPhaseInput,
  TrainingGoalValue,
  TrainingPhase,
  UpdateTrainingPlanRemarksInput,
} from "@fitnesstracker/shared";

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

export function useChangeTrainingPhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phase: TrainingPhase) => changeTrainingPhaseRequest({ phase }),
    onSuccess: (plan) => {
      queryClient.setQueryData(TRAINING_PLAN_KEY, plan);
      void queryClient.invalidateQueries({ queryKey: ["cardio", "plan"] });
    },
  });
}

export function useAddTrainingPhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddTrainingPhaseInput) => addTrainingPhaseRequest(input),
    onSuccess: (plan) => {
      queryClient.setQueryData(TRAINING_PLAN_KEY, plan);
    },
  });
}

export function useRenameTrainingPhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ phase, input }: { phase: TrainingPhase; input: RenameTrainingPhaseInput }) =>
      renameTrainingPhaseRequest(phase, input),
    onSuccess: (plan) => {
      queryClient.setQueryData(TRAINING_PLAN_KEY, plan);
    },
  });
}

export function useDeleteTrainingPhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phase: TrainingPhase) => deleteTrainingPhaseRequest(phase),
    onSuccess: (plan) => {
      queryClient.setQueryData(TRAINING_PLAN_KEY, plan);
      void queryClient.invalidateQueries({ queryKey: ["plan-exercises"] });
      void queryClient.invalidateQueries({ queryKey: ["cardio", "plan"] });
    },
  });
}

export function usePauseTrainingPlan() {
  return useTrainingPlanAction(pauseTrainingPlanRequest);
}

export function useResumeTrainingPlan() {
  return useTrainingPlanAction(resumeTrainingPlanRequest);
}

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
