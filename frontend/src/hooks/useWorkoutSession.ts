import { useMutation, useQuery } from "@tanstack/react-query";
import type { WorkoutSessionKind, WorkoutSessionStatus } from "@fitnesstracker/shared";
import {
  fetchAndCacheOpenSession,
  startWorkoutSessionLocal,
  keepWorkoutSessionAliveLocal,
  updateWorkoutSessionStatusLocal,
  workoutSessionQueryKey,
} from "../offline/workoutSessionSync";

// Same `networkMode: "always"` rationale as useWorkoutLogs: the queryFn already falls back to
// the local Dexie cache on its own, so it must run even while offline instead of parking as
// "pending" under the default online-only mode.
//
// `kind`: the regular workout (default) or the Daily session, which runs next to it.
export function useOpenWorkoutSession(kind: WorkoutSessionKind = "TRAINING") {
  return useQuery({
    queryKey: workoutSessionQueryKey(kind),
    queryFn: () => fetchAndCacheOpenSession(kind),
    networkMode: "always",
    // The server can raise the "Training noch aktiv?" prompt or auto-complete the session while
    // the app stays open, so look again once a minute.
    refetchInterval: 60_000,
  });
}

// The mutation functions write to the local Dexie cache themselves (see workoutSessionSync.ts)
// and never touch the network directly, so `networkMode: "always"` is essential here too — with
// the default mode a mutation started offline would just sit "paused" until reconnect instead of
// running immediately.
export function useStartWorkoutSession() {
  return useMutation({
    mutationFn: ({ clientId, kind }: { clientId: string; kind?: WorkoutSessionKind }) =>
      startWorkoutSessionLocal(clientId, kind),
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

export function useKeepWorkoutSessionAlive() {
  return useMutation({ mutationFn: (clientId: string) => keepWorkoutSessionAliveLocal(clientId) });
}
