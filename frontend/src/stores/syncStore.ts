import { create } from "zustand";
import type { FailedMutation } from "../offline/db";

interface SyncState {
  isOnline: boolean;
  // True while a flush loop (workoutLogSync or workoutSessionSync) is actively draining its
  // queue — see beginSync/endSync below. Ref-counted rather than a plain boolean because both
  // queues can flush concurrently; the indicator should read "syncing" until both are done.
  isSyncing: boolean;
  // Combined across both offline queues (workout logs + sessions) — see offline/syncCounts.ts.
  pendingCount: number;
  // Mutations the server permanently rejected — dropped from the pending queue (retrying the
  // exact same request wouldn't change the outcome) but kept here, retryable, so nothing a user
  // entered offline just silently vanishes. See offline/retry.ts.
  failedMutations: FailedMutation[];
  failedCount: number;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  setPendingCount: (pendingCount: number) => void;
  setFailedMutations: (failedMutations: FailedMutation[]) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  failedMutations: [],
  failedCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setFailedMutations: (failedMutations) => set({ failedMutations, failedCount: failedMutations.length }),
}));

let syncingRefCount = 0;

export function beginSync() {
  syncingRefCount += 1;
  useSyncStore.getState().setSyncing(true);
}

export function endSync() {
  syncingRefCount = Math.max(0, syncingRefCount - 1);
  useSyncStore.getState().setSyncing(syncingRefCount > 0);
}
