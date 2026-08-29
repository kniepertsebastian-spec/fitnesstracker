import { offlineDb, type FailedMutation } from "./db";
import { refreshSyncCounts } from "./syncCounts";
import { flushPendingMutations } from "./workoutLogSync";
import { flushPendingSessionMutations } from "./workoutSessionSync";

// Re-queues a dropped mutation using its saved payload — the user never has to redo the
// original action. A retry can still fail again (e.g. the same validation issue), in which case
// it lands right back in failedMutations with a fresh reason.
export async function retryFailedMutation(failed: FailedMutation) {
  const table = failed.kind === "workoutLog" ? offlineDb.pendingMutations : offlineDb.pendingSessionMutations;
  await table.add({
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
