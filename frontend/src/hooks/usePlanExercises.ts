import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePlanExerciseInput, TrainingPhase, UpdatePlanExerciseInput } from "@fitnesstracker/shared";
import {
  createPlanExerciseRequest,
  deletePlanExerciseRequest,
  listPlanExercisesRequest,
  updatePlanExerciseRequest,
} from "../api/planExercise.api";

const planExercisesKey = (phase: TrainingPhase) => ["plan-exercises", phase];

export function usePlanExercises(phase: TrainingPhase, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: planExercisesKey(phase),
    queryFn: () => listPlanExercisesRequest(phase).then((r) => r.items),
    enabled: options?.enabled ?? true,
  });
}

export function useCreatePlanExercise(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanExerciseInput) => createPlanExerciseRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planExercisesKey(phase) }),
  });
}

export function useUpdatePlanExercise(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlanExerciseInput }) =>
      updatePlanExerciseRequest(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planExercisesKey(phase) }),
  });
}

export function useDeletePlanExercise(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePlanExerciseRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: planExercisesKey(phase) }),
  });
}
