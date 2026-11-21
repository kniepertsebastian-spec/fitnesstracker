import { offlineDb, type FailedMutation } from "./db";
import { refreshSyncCounts } from "./syncCounts";
import { flushPendingMutations } from "./workoutLogSync";
import { flushPendingSessionMutations } from "./workoutSessionSync";
import { flushPendingCardioLogs } from "./cardioLogSync";
import { requeueFailedPlanOp } from "./planEditSync";

// Re-queues a dropped mutation using its saved payload — the user never has to redo the
// original action. A retry can still fail again (e.g. the same validation issue), in which case
// it lands right back in failedMutations with a fresh reason.
export async function retryFailedMutation(failed: FailedMutation) {
  if (failed.kind === "workoutLog" && !failed.accountId) {
    throw new Error("Diese ältere Offline-Änderung hat keine Account-Zuordnung und kann nicht sicher erneut synchronisiert werden.");
  }
  if (failed.kind === "planEdit") {
    await requeueFailedPlanOp(failed);
    return;
  }
  if (failed.kind === "cardioLog") {
    await offlineDb.pendingCardioLogs.add({
      ...(failed.accountId ? { accountId: failed.accountId } : {}),
      clientId: failed.clientId,
      payload: failed.payload,
      label: failed.label,
      queuedAt: new Date().toISOString(),
    });
    await offlineDb.failedMutations.delete(failed.id as number);
    await refreshSyncCounts();
    void flushPendingCardioLogs();
    return;
  }
  const table = failed.kind === "workoutLog" ? offlineDb.pendingMutations : offlineDb.pendingSessionMutations;
  await table.add({
    ...(failed.accountId ? { accountId: failed.accountId } : {}),
    clientId: failed.clientId,
    op: failed.op,
    payload: failed.payload,
    queuedAt: new Date().toISOString(),
  });
  await offlineDb.failedMutations.delete(failed.id as number);
  await refreshSyncCounts();

  if (failed.kind === "workoutLog") {
    void flushPendingMutations();
  } else {
    void flushPendingSessionMutations();
  }
}

export async function retryAllFailedMutations(failedMutations: FailedMutation[]) {
  for (const failed of failedMutations) {
    await retryFailedMutation(failed);
  }
}

// Only a rejected plan change can be dropped: it is already undone on the device (it stayed a
// today-only change), so discarding just removes the entry. Rejected sets, sessions and cardio
// entries still exist only on this device and are kept until a retry gets them to the server.
export function canDiscardFailedMutation(failed: FailedMutation): boolean {
  return failed.kind === "planEdit";
}

export async function discardFailedMutation(failed: FailedMutation) {
  if (!canDiscardFailedMutation(failed)) return;
  await offlineDb.failedMutations.delete(failed.id as number);
  await refreshSyncCounts();
}
