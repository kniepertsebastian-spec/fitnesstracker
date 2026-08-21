import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateGoalInput, GoalType, UpdateGoalInput } from "@fitnesstracker/shared";
import {
  createGoalRequest,
  deleteGoalRequest,
  listGoalSuggestionsRequest,
  listGoalsRequest,
  updateGoalRequest,
} from "../api/goal.api";

const GOALS_KEY = ["goals"];
// Deliberately not nested under GOALS_KEY — TanStack Query's invalidation matches by prefix, so
// a shared prefix would make the second invalidateQueries call below redundant with the first.
const GOAL_SUGGESTIONS_KEY = ["goal-suggestions"];

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

export function useGoalSuggestions() {
  return useQuery({
    queryKey: GOAL_SUGGESTIONS_KEY,
    queryFn: () => listGoalSuggestionsRequest().then((r) => r.items),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => createGoalRequest(input),
    // A new WEIGHT goal can make its exercise ineligible for a suggestion (already-open-goal
    // exclusion in getGoalSuggestions), so the suggestions list needs a refresh too, not just
    // the goals list.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      queryClient.invalidateQueries({ queryKey: GOAL_SUGGESTIONS_KEY });
    },
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
