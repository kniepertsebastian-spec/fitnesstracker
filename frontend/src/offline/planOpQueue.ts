import type { CreatePlanExerciseInput, UpdatePlanExerciseInput } from "@fitnesstracker/shared";
import { currentAccountId, lastKnownAccountId } from "./account";

// Storage of the plan-change queue (see planEditSync.ts for how it is sent). Kept in its own
// module so syncCounts.ts can count it without importing the sync loop itself.

export type PlanOp =
  | { type: "update"; id: string; body: UpdatePlanExerciseInput }
  | { type: "delete"; id: string }
  | { type: "create"; body: CreatePlanExerciseInput }
  | { type: "swapOrder"; a: { id: string; order: number }; b: { id: string; order: number } };

export interface QueuedPlanOp {
  // Whose plan the change is for. Entries from before this field existed are claimed by the
  // account last signed in on this device the first time the queue is read.
  accountId?: string;
  editId: string;
  sessionClientId: string;
  op: PlanOp;
}

export const PLAN_QUEUE_KEY = "fitnesstracker.plan-edit-queue";

export function readAllQueuedPlanOps(): QueuedPlanOp[] {
  try {
    const queue = JSON.parse(localStorage.getItem(PLAN_QUEUE_KEY) ?? "[]") as QueuedPlanOp[];
    if (!Array.isArray(queue)) return [];
    const claimant = lastKnownAccountId();
    if (claimant && queue.some((q) => !q.accountId)) {
      const claimed = queue.map((q) => (q.accountId ? q : { ...q, accountId: claimant }));
      localStorage.setItem(PLAN_QUEUE_KEY, JSON.stringify(claimed));
      return claimed;
    }
    return queue;
  } catch {
    return [];
  }
}

// The queue holds every account's pending changes; each account only ever sees and sends its own.
export function readPlanQueue(accountId: string | null = currentAccountId()): QueuedPlanOp[] {
  if (!accountId) return [];
  return readAllQueuedPlanOps().filter((q) => q.accountId === accountId);
}

export function writePlanQueue(queue: QueuedPlanOp[], accountId: string | null = currentAccountId()) {
  try {
    const others = readAllQueuedPlanOps().filter((q) => q.accountId !== accountId);
    const all = [...others, ...queue];
    if (all.length === 0) localStorage.removeItem(PLAN_QUEUE_KEY);
    else localStorage.setItem(PLAN_QUEUE_KEY, JSON.stringify(all));
  } catch {
    // Without storage the op still runs now if online; it just can't wait for a reconnect.
  }
}

// Plan changes of this account that the server has not confirmed yet — part of the "ausstehend"
// count (sync indicator, app badge and the offline-logout warning).
export function pendingPlanOpsCount(accountId: string | null = currentAccountId()): number {
  return readPlanQueue(accountId).length;
}
