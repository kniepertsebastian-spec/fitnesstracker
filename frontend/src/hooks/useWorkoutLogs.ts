import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateWorkoutLogInput, UpdateWorkoutLogInput } from "@fitnesstracker/shared";
import {
  createWorkoutLogRequest,
  deleteWorkoutLogRequest,
  listExercisesRequest,
  listWorkoutLogsRequest,
  updateWorkoutLogRequest,
} from "../api/workoutLog.api";

const WORKOUT_LOGS_KEY = ["workout-logs"];
const EXERCISES_KEY = ["exercises"];

export function useWorkoutLogs() {
  return useQuery({
    queryKey: WORKOUT_LOGS_KEY,
    queryFn: () => listWorkoutLogsRequest().then((r) => r.items),
  });
}

export function useExercises() {
  return useQuery({
    queryKey: EXERCISES_KEY,
    queryFn: () => listExercisesRequest().then((r) => r.items),
  });
}

export function useCreateWorkoutLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkoutLogInput) => createWorkoutLogRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKOUT_LOGS_KEY }),
  });
}

export function useUpdateWorkoutLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWorkoutLogInput }) =>
      updateWorkoutLogRequest(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKOUT_LOGS_KEY }),
  });
}

export function useDeleteWorkoutLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkoutLogRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKOUT_LOGS_KEY }),
  });
}
