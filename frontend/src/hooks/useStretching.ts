import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StretchFocusMuscle, TrainingPhase } from "@fitnesstracker/shared";
import {
  generateStretchPlanRequest,
  getDailyStretchRequest,
  getStretchPlanRequest,
  resetStretchPlanRequest,
} from "../api/stretching.api";

const stretchPlanKey = (phase: TrainingPhase) => ["stretching", "plan", phase];

export function useStretchPlan(phase: TrainingPhase) {
  return useQuery({
    queryKey: stretchPlanKey(phase),
    queryFn: () => getStretchPlanRequest(phase),
  });
}

export function useGenerateStretchPlan(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateStretchPlanRequest(phase),
    onSuccess: (plan) => queryClient.setQueryData(stretchPlanKey(phase), plan),
  });
}

export function useResetStretchPlan(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetStretchPlanRequest(phase),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stretchPlanKey(phase) }),
  });
}

export function useDailyStretch(focus: StretchFocusMuscle | null) {
  return useQuery({
    queryKey: ["stretching", "daily", focus],
    queryFn: () => getDailyStretchRequest(focus),
  });
}
