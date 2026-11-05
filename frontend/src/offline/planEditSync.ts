import type { CreatePlanExerciseInput, UpdatePlanExerciseInput } from "@fitnesstracker/shared";
import {
  createPlanExerciseRequest,
  deletePlanExerciseRequest,
  updatePlanExerciseRequest,
} from "../api/planExercise.api";
import { ApiError } from "../api/client";
import { queryClient } from "../queryClient";
import { loadPlanEdits, savePlanEdits } from "../lib/planEdits";
import { currentAccountId, isTransientFailure, lastKnownAccountId } from "./account";

// Permanent plan changes made in focus mode ("dauerhaft im Plan"): applied to the workout at
// once (lib/planEdits.ts) and sent to the server from this queue, now or as soon as the device
// is back online. Kept in localStorage — a handful of small entries, and the plan endpoints are
// not idempotent per client id, so each op is sent once and removed on any server answer.

export type PlanOp =
  | { type: "update"; id: string; body: UpdatePlanExerciseInput }
  | { type: "delete"; id: string }
  | { type: "create"; body: CreatePlanExerciseInput }
  | { type: "swapOrder"; a: { id: string; order: number }; b: { id: string; order: number } };

interface QueuedOp {
  // Whose plan the change is for. Entries from before this field existed are claimed by the
  // account last signed in on this device the first time the queue is read.
  accountId?: string;
  editId: string;
  sessionClientId: string;
  op: PlanOp;
}

const QUEUE_KEY = "fitnesstracker.plan-edit-queue";
export const PLAN_EDITS_EVENT = "fitnesstracker:plan-edits";

function readAllQueued(): QueuedOp[] {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedOp[];
    const claimant = lastKnownAccountId();
    if (claimant && queue.some((q) => !q.accountId)) {
      const claimed = queue.map((q) => (q.accountId ? q : { ...q, accountId: claimant }));
      localStorage.setItem(QUEUE_KEY, JSON.stringify(claimed));
      return claimed;
    }
    return queue;
  } catch {
    return [];
  }
}

// The queue holds every account's pending changes; each account only ever sees and sends its own.
function readQueue(): QueuedOp[] {
  const accountId = currentAccountId();
  return readAllQueued().filter((q) => q.accountId === accountId);
}

function writeQueue(queue: QueuedOp[]) {
  try {
    const accountId = currentAccountId();
    const others = readAllQueued().filter((q) => q.accountId !== accountId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify([...others, ...queue]));
  } catch {
    // Without storage the op still runs now if online; it just can't wait for a reconnect.
  }
}

export function enqueuePlanOp(entry: Omit<QueuedOp, "accountId">) {
  const accountId = currentAccountId();
  if (!accountId) return;
  writeQueue([...readQueue(), { ...entry, accountId }]);
  void flushPlanOps();
}

// Drops queued ops of an edit that was undone before it reached the server.
export function dropQueuedPlanOps(editId: string) {
  writeQueue(readQueue().filter((q) => q.editId !== editId));
}

export function hasQueuedPlanOps(editId: string): boolean {
  return readQueue().some((q) => q.editId === editId);
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

let flushing = false;

export async function flushPlanOps() {
  const accountId = currentAccountId();
  if (flushing || !navigator.onLine || !accountId) return;
  flushing = true;
  // editId → whether the server took it (false: rejected, keep it as a today-only change).
  const results = new Map<string, boolean>();
  const sessions = new Set<string>();
  try {
    for (;;) {
      if (currentAccountId() !== accountId) break;
      const [next] = readQueue();
      if (!next) break;
      try {
        await send(next.op);
        results.set(next.editId, results.get(next.editId) ?? true);
      } catch (error) {
        // Offline, a server error (5xx), rate limit or an expired session: keep the change
        // queued and send it again later. Only an answer that rejects the request itself drops it.
        if (!(error instanceof ApiError) || isTransientFailure(error)) break;
        console.error("Plan change rejected by the server", next, error);
        results.set(next.editId, false);
      }
      sessions.add(next.sessionClientId);
      // Only this loop removes from the front; check it's still the same op (it may have been
      // dropped by an undo meanwhile).
      const queue = readQueue();
      if (queue.length > 0 && JSON.stringify(queue[0]) === JSON.stringify(next)) writeQueue(queue.slice(1));
    }
  } finally {
    flushing = false;
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
      return ok ? { ...e, synced: true } : { ...e, permanent: false };
    });
    savePlanEdits(sessionClientId, edits);
  }
  window.dispatchEvent(new Event(PLAN_EDITS_EVENT));
}

let initialized = false;

export function initPlanEditSync() {
  if (initialized) return;
  initialized = true;
  window.addEventListener("online", () => void flushPlanOps());
  if (navigator.onLine) void flushPlanOps();
  // A server error leaves changes queued; try again every minute like the set/session queues do.
  setInterval(() => {
    if (navigator.onLine) void flushPlanOps();
  }, 60_000);
}
