import { offlineDb } from "./db";
import { useSyncStore } from "../stores/syncStore";

// Single source of truth for the "X ausstehend"/"X fehlgeschlagen" badges in AppShell — both
// offline queues (workoutLogSync.ts, workoutSessionSync.ts) call this after every local queue
// change instead of each maintaining its own half of the sync store.
export async function refreshSyncCounts() {
  const [logCount, sessionCount, failedCount] = await Promise.all([
    offlineDb.pendingMutations.count(),
    offlineDb.pendingSessionMutations.count(),
    offlineDb.failedMutations.count(),
  ]);
  useSyncStore.getState().setPendingCount(logCount + sessionCount);
  useSyncStore.getState().setFailedCount(failedCount);
}
