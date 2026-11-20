import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadStretchDone, loadStretchFocus, loadStretchShuffle, stretchDoneKey } from "../lib/stretchStorage";
import type { StretchChoice, TrainingPhase } from "@fitnesstracker/shared";
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

export function useDailyStretch(choice: StretchChoice, shuffle = 0) {
  return useQuery({
    queryKey: ["stretching", "daily", choice, shuffle],
    queryFn: () => getDailyStretchRequest(choice, shuffle),
  });
}

// Dashboard checklist: is today's stretch routine (for the remembered focus) fully ticked off?
// The ticks live per device in localStorage, written by StretchList.
export function useDailyStretchStatus() {
  const choice = loadStretchFocus();
  const shuffle = loadStretchShuffle();
  const { data } = useDailyStretch(choice, shuffle);
  const done = loadStretchDone(stretchDoneKey(choice, shuffle));
  const total = data?.items.length ?? 0;
  const completed = data ? data.items.filter((i) => done.includes(i.exerciseId)).length : 0;
  return { total, completed, isDone: total > 0 && completed >= total };
}
