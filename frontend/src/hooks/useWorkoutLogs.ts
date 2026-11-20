import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CreateWorkoutLogInput, UpdateWorkoutLogInput } from "@fitnesstracker/shared";
import { useExerciseCatalog } from "./useExerciseLibrary";
import { useAuthStore } from "../stores/authStore";
import {
  createWorkoutLogLocal,
  deleteWorkoutLogLocal,
  fetchAndCacheWorkoutLogs,
  updateWorkoutLogLocal,
  WORKOUT_LOGS_QUERY_KEY,
} from "../offline/workoutLogSync";

export function useWorkoutLogs() {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: [...WORKOUT_LOGS_QUERY_KEY, userId],
    queryFn: () => userId ? fetchAndCacheWorkoutLogs(userId) : Promise.resolve([]),
    enabled: Boolean(userId),
    // Default `networkMode: "online"` would leave this query stuck "pending" while offline
    // instead of running the queryFn — but the queryFn already falls back to the local cache
    // itself, so it needs to run regardless of connectivity.
    networkMode: "always",
  });
}

// Every active exercise the user can pick, from the local copy of the catalog (works offline).
export function useExercises() {
  const query = useExerciseCatalog();
  const data = useMemo(() => query.data?.filter((e) => e.isActive), [query.data]);
  return { ...query, data };
}

// The mutation functions below already update the query cache themselves (from the local Dexie
// cache, never the network — see offline/workoutLogSync.ts) so these hooks don't need an
// onSuccess/invalidateQueries: that would await a network refetch that's doomed while offline.
//
// `networkMode: "always"` is essential here, not cosmetic: with the default `"online"` mode,
// React Query *never calls mutationFn while offline* — it parks the mutation as "paused" and
// waits for a reconnect. These mutationFns are local Dexie writes with no network step of their
// own, so without this they'd silently never run until the device came back online, defeating
// the entire point of logging a set at the gym with no signal.
export function useCreateWorkoutLog() {
  return useMutation({
    mutationFn: ({ input, exerciseName }: { input: CreateWorkoutLogInput; exerciseName: string }) =>
      createWorkoutLogLocal(input, exerciseName),
    networkMode: "always",
  });
}

export function useUpdateWorkoutLog() {
  return useMutation({
    mutationFn: ({
      clientId,
      input,
      exerciseName,
    }: {
      clientId: string;
      input: UpdateWorkoutLogInput;
      exerciseName?: string;
    }) => updateWorkoutLogLocal(clientId, input, exerciseName),
    networkMode: "always",
  });
}

export function useDeleteWorkoutLog() {
  return useMutation({
    mutationFn: (clientId: string) => deleteWorkoutLogLocal(clientId),
    networkMode: "always",
  });
}
