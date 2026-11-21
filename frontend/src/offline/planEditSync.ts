import {
  createPlanExerciseRequest,
  deletePlanExerciseRequest,
  updatePlanExerciseRequest,
} from "../api/planExercise.api";
import { ApiError } from "../api/client";
import { queryClient } from "../queryClient";
import { loadPlanEdits, savePlanEdits } from "../lib/planEdits";
import { beginSync, endSync } from "../stores/syncStore";
import { currentAccountId, isTransientFailure } from "./account";
import { offlineDb, type FailedMutation, type MutationOp } from "./db";
import { readPlanQueue, writePlanQueue, type PlanOp, type QueuedPlanOp } from "./planOpQueue";
import { refreshSyncCounts } from "./syncCounts";

// Permanent plan changes made in focus mode ("dauerhaft im Plan"): applied to the workout at
// once (lib/planEdits.ts) and sent to the server from this queue, now or as soon as the device
// is back online. Kept in localStorage — a handful of small entries, and the plan endpoints are
// not idempotent per client id, so each op is sent once and removed on any server answer.
// Queued changes count as "ausstehend" in the sync indicator (syncCounts.ts); a change the server
// rejects outright lands in failedMutations (kind "planEdit"), where it can be retried or dropped.

export type { PlanOp } from "./planOpQueue";
export { pendingPlanOpsCount } from "./planOpQueue";

export const PLAN_EDITS_EVENT = "fitnesstracker:plan-edits";

export function enqueuePlanOp(entry: Omit<QueuedPlanOp, "accountId">) {
  const accountId = currentAccountId();
  if (!accountId) return;
  writePlanQueue([...readPlanQueue(accountId), { ...entry, accountId }], accountId);
  void refreshSyncCounts();
  void flushPlanOps();
}

// Drops queued ops of an edit that was undone before it reached the server.
export function dropQueuedPlanOps(editId: string) {
  writePlanQueue(readPlanQueue().filter((q) => q.editId !== editId));
  void refreshSyncCounts();
}

export function hasQueuedPlanOps(editId: string): boolean {
  return readPlanQueue().some((q) => q.editId === editId);
}

async function send(op: PlanOp) {
  if (op.type === "update") await updatePlanExerciseRequest(op.id, op.body);
  else if (op.type === "delete") await deletePlanExerciseRequest(op.id);
  else if (op.type === "create") await createPlanExerciseRequest(op.body);
  else {
    await updatePlanExerciseRequest(op.a.id, { order: op.b.order });
    await updatePlanExerciseRequest(op.b.id, { order: op.a.order });
  }
}

const OP_KIND: Record<PlanOp["type"], MutationOp> = {
  update: "update",
  delete: "delete",
  create: "create",
  swapOrder: "update",
};

// What the sync panel shows for a rejected change, taken from the focus-mode edit it came from.
export function planOpLabel(entry: QueuedPlanOp): string {
  const edit = loadPlanEdits(entry.sessionClientId).find((e) => e.id === entry.editId);
  if (edit?.kind === "replace") return `Plan: ${edit.exerciseName} getauscht`;
  if (edit?.kind === "add") return `Plan: ${edit.exerciseName} hinzugefügt`;
  if (edit?.kind === "remove" || entry.op.type === "delete") return "Plan: Übung entfernt";
  if (edit?.kind === "move" || entry.op.type === "swapOrder") return "Plan: Reihenfolge geändert";
  return "Planänderung";
}

async function recordFailedPlanOp(accountId: string, entry: QueuedPlanOp, error: ApiError) {
  console.error("Plan change rejected by the server", entry, error);
  try {
    await offlineDb.failedMutations.add({
      accountId,
      kind: "planEdit",
      clientId: entry.editId,
      op: OP_KIND[entry.op.type],
      // The whole queue entry, so a retry can put back exactly the same change.
      payload: { ...entry, accountId } as unknown as Record<string, unknown>,
      label: planOpLabel(entry),
      reason: error.message,
      failedAt: new Date().toISOString(),
    });
  } catch (dbError) {
    // The change itself stays applied for today (see the edit handling in flushPlanOps).
    console.error("Could not record the rejected plan change", dbError);
  }
}

function isQueuedPlanOp(value: unknown): value is QueuedPlanOp {
  const v = value as Partial<QueuedPlanOp> | null;
  return (
    !!v &&
    typeof v.editId === "string" &&
    typeof v.sessionClientId === "string" &&
    !!v.op &&
    typeof v.op === "object" &&
    typeof (v.op as { type?: unknown }).type === "string"
  );
}

// "Erneut versuchen" for a rejected plan change: puts the saved op back into the queue (for the
// account that made it) and sends it. If the server rejects it again it returns to the failed list.
export async function requeueFailedPlanOp(failed: FailedMutation) {
  const accountId = failed.accountId ?? currentAccountId();
  if (!accountId || !isQueuedPlanOp(failed.payload)) {
    throw new Error("Diese Planänderung kann nicht erneut gesendet werden.");
  }
  const { editId, sessionClientId, op } = failed.payload;
  writePlanQueue([...readPlanQueue(accountId), { accountId, editId, sessionClientId, op }], accountId);
  await offlineDb.failedMutations.delete(failed.id as number);
  await refreshSyncCounts();
  void flushPlanOps();
}

let flushing = false;

export async function flushPlanOps() {
  const accountId = currentAccountId();
  if (flushing || !navigator.onLine || !accountId) return;
  flushing = true;
  beginSync();
  // editId → whether the server took it (false: rejected, keep it as a today-only change).
  const results = new Map<string, boolean>();
  const sessions = new Set<string>();
  try {
    for (;;) {
      if (currentAccountId() !== accountId) break;
      const [next] = readPlanQueue(accountId);
      if (!next) break;
      try {
        await send(next.op);
        results.set(next.editId, results.get(next.editId) ?? true);
      } catch (error) {
        // Offline, a server error (5xx), rate limit or an expired session: keep the change
        // queued and send it again later. Only an answer that rejects the request itself drops it
        // from the queue — into the failed list, where the user can retry or discard it.
        if (!(error instanceof ApiError) || isTransientFailure(error)) break;
        await recordFailedPlanOp(accountId, next, error);
        results.set(next.editId, false);
      }
      sessions.add(next.sessionClientId);
      // Only this loop removes from the front; check it's still the same op (it may have been
      // dropped by an undo meanwhile).
      const queue = readPlanQueue(accountId);
      if (queue.length > 0 && JSON.stringify(queue[0]) === JSON.stringify(next)) writePlanQueue(queue.slice(1), accountId);
    }
  } finally {
    flushing = false;
    endSync();
    await refreshSyncCounts();
  }
  if (results.size === 0) return;

  // Refetch first, then stop applying the edits on top — otherwise the view would briefly show
  // the old plan between "synced" and the refetched data.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["plan-exercises"] }),
    queryClient.invalidateQueries({ queryKey: ["stretching"] }),
  ]);
  for (const sessionClientId of sessions) {
    const edits = loadPlanEdits(sessionClientId).map((e) => {
      const ok = results.get(e.id);
      if (ok === undefined || hasQueuedPlanOps(e.id)) return e;
      // `permanent: true` again for a change that only got through on a manual retry.
      return ok ? { ...e, permanent: true, synced: true } : { ...e, permanent: false };
    });
    savePlanEdits(sessionClientId, edits);
  }
  window.dispatchEvent(new Event(PLAN_EDITS_EVENT));
}

let initialized = false;

export function initPlanEditSync() {
  if (initialized) return;
  initialized = true;
  void refreshSyncCounts();
  window.addEventListener("online", () => void flushPlanOps());
  if (navigator.onLine) void flushPlanOps();
  // A server error leaves changes queued; try again every minute like the set/session queues do.
  setInterval(() => {
    if (navigator.onLine) void flushPlanOps();
  }, 60_000);
}
