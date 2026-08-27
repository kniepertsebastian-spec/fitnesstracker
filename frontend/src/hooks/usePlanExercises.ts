import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatePlanExerciseInput, TrainingPhase, UpdatePlanExerciseInput } from "@fitnesstracker/shared";
import {
  createPlanExerciseRequest,
  deletePlanExerciseRequest,
  getWeeklyPlanStatusRequest,
  listPlanExercisesRequest,
  updatePlanExerciseRequest,
} from "../api/planExercise.api";

const planExercisesKey = (phase: TrainingPhase) => ["plan-exercises", phase];
const weeklyPlanStatusKey = (phase: TrainingPhase) => ["plan-exercises", "week-status", phase];

export function usePlanExercises(phase: TrainingPhase, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: planExercisesKey(phase),
    queryFn: () => listPlanExercisesRequest(phase).then((r) => r.items),
    enabled: options?.enabled ?? true,
  });
}

// Drives the dashboard's progressive day unlock — see planWeekStatus.service.ts.
export function useWeeklyPlanStatus(phase: TrainingPhase, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: weeklyPlanStatusKey(phase),
    queryFn: () => getWeeklyPlanStatusRequest(phase),
    enabled: options?.enabled ?? true,
  });
}

// The two query keys don't share a prefix (`phase` vs. `"week-status"` sits at the same array
// position), so invalidating one never implicitly invalidates the other — every mutation that
// changes a phase's plan needs to invalidate both explicitly.
function invalidatePlan(queryClient: ReturnType<typeof useQueryClient>, phase: TrainingPhase) {
  queryClient.invalidateQueries({ queryKey: planExercisesKey(phase) });
  queryClient.invalidateQueries({ queryKey: weeklyPlanStatusKey(phase) });
}

export function useCreatePlanExercise(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePlanExerciseInput) => createPlanExerciseRequest(input),
    onSuccess: () => invalidatePlan(queryClient, phase),
  });
}

export function useUpdatePlanExercise(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlanExerciseInput }) =>
      updatePlanExerciseRequest(id, input),
    onSuccess: () => invalidatePlan(queryClient, phase),
  });
}

export function useDeletePlanExercise(phase: TrainingPhase) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePlanExerciseRequest(id),
    onSuccess: () => invalidatePlan(queryClient, phase),
  });
}
