import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateGoalInput, GoalType, UpdateGoalInput } from "@fitnesstracker/shared";
import {
  createGoalRequest,
  deleteGoalRequest,
  listGoalsRequest,
  updateGoalRequest,
} from "../api/goal.api";

const GOALS_KEY = ["goals"];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  WEIGHT: "Gewicht (Übung)",
  REPS: "Wiederholungen (Übung)",
  BODYWEIGHT: "Körpergewicht",
  CUSTOM: "Sonstiges",
};

export const GOAL_TYPE_UNITS: Record<GoalType, string> = {
  WEIGHT: "kg",
  REPS: "Wdh.",
  BODYWEIGHT: "kg",
  CUSTOM: "",
};

export function useGoals() {
  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: () => listGoalsRequest().then((r) => r.items),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoalRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateGoalInput }) => updateGoalRequest(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteGoalRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  });
}
