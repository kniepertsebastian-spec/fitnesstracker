import { create } from "zustand";

interface SyncState {
  isOnline: boolean;
  // Combined across both offline queues (workout logs + sessions) — see offline/syncCounts.ts.
  pendingCount: number;
  // Mutations the server permanently rejected (not retried) — see FailedMutation in offline/db.ts.
  failedCount: number;
  setOnline: (isOnline: boolean) => void;
  setPendingCount: (pendingCount: number) => void;
  setFailedCount: (failedCount: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  failedCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setFailedCount: (failedCount) => set({ failedCount }),
}));
