import { offlineDb } from "./db";
import { useSyncStore } from "../stores/syncStore";
import { currentAccountId } from "./account";

// Single source of truth for the sync status indicator in AppShell — both offline queues
// (workoutLogSync.ts, workoutSessionSync.ts) call this after every local queue change instead
// of each maintaining its own half of the sync store.
export async function refreshSyncCounts() {
  const accountId = currentAccountId();
  if (!accountId) {
    useSyncStore.getState().setPendingCount(0);
    useSyncStore.getState().setFailedMutations([]);
    return;
  }
  const [logCount, sessionCount, cardioCount, failed] = await Promise.all([
    offlineDb.pendingMutations.where("accountId").equals(accountId).count(),
    offlineDb.pendingSessionMutations.where("accountId").equals(accountId).count(),
    offlineDb.pendingCardioLogs.where("accountId").equals(accountId).count(),
    offlineDb.failedMutations.where("accountId").equals(accountId).toArray(),
  ]);
  failed.sort((a, b) => (a.failedAt < b.failedAt ? 1 : -1));
  useSyncStore.getState().setPendingCount(logCount + sessionCount + cardioCount);
  useSyncStore.getState().setFailedMutations(failed);
}
