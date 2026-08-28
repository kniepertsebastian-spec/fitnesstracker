import { useMutation, useQuery } from "@tanstack/react-query";
import type { WorkoutSessionStatus } from "@fitnesstracker/shared";
import {
  fetchAndCacheOpenSession,
  startWorkoutSessionLocal,
  updateWorkoutSessionStatusLocal,
  WORKOUT_SESSION_QUERY_KEY,
} from "../offline/workoutSessionSync";

// Same `networkMode: "always"` rationale as useWorkoutLogs: the queryFn already falls back to
// the local Dexie cache on its own, so it must run even while offline instead of parking as
// "pending" under the default online-only mode.
export function useOpenWorkoutSession() {
  return useQuery({
    queryKey: WORKOUT_SESSION_QUERY_KEY,
    queryFn: fetchAndCacheOpenSession,
    networkMode: "always",
  });
}

// The mutation functions write to the local Dexie cache themselves (see workoutSessionSync.ts)
// and never touch the network directly, so `networkMode: "always"` is essential here too — with
// the default mode a mutation started offline would just sit "paused" until reconnect instead of
// running immediately.
export function useStartWorkoutSession() {
  return useMutation({
    mutationFn: (clientId: string) => startWorkoutSessionLocal(clientId),
    networkMode: "always",
  });
}

export function useUpdateWorkoutSessionStatus() {
  return useMutation({
    mutationFn: ({ clientId, status }: { clientId: string; status: WorkoutSessionStatus }) =>
      updateWorkoutSessionStatusLocal(clientId, status),
    networkMode: "always",
  });
}
