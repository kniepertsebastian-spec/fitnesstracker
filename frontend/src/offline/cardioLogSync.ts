import type { CreateCardioLogInput } from "@fitnesstracker/shared";
import { createCardioLogRequest } from "../api/cardioLog.api";
import { ApiError } from "../api/client";
import { queryClient } from "../queryClient";
import { beginSync, endSync } from "../stores/syncStore";
import { offlineDb } from "./db";
import { refreshSyncCounts } from "./syncCounts";
import { currentAccountId, isTransientFailure } from "./account";

// F9: cardio entries go through a small create-only queue, like sets and sessions — a cardio
// block finished in the gym without signal must not be lost. The server create is idempotent per
// clientId, so a request whose response got lost can simply be sent again.

export const CARDIO_LOGS_QUERY_PREFIX = ["cardio-logs"];

export type QueuedCardioLogInput = CreateCardioLogInput & { clientId: string; performedAt: string };

export async function createCardioLogLocal(input: QueuedCardioLogInput, label: string) {
  const accountId = currentAccountId();
  if (!accountId) throw new Error("Zum Speichern muss ein Account angemeldet sein.");
  await offlineDb.pendingCardioLogs.add({
    accountId,
    clientId: input.clientId,
    payload: input,
    label,
    queuedAt: new Date().toISOString(),
  });
  await refreshSyncCounts();
  void flushPendingCardioLogs();
}

let flushing = false;

export async function flushPendingCardioLogs() {
  const accountId = currentAccountId();
  if (flushing || !navigator.onLine || !accountId) return;
  flushing = true;
  beginSync();
  let changed = false;
  try {
    for (;;) {
      if (currentAccountId() !== accountId) break;
      const [next] = await offlineDb.pendingCardioLogs.where("accountId").equals(accountId).sortBy("queuedAt");
      if (!next) break;
      try {
        await createCardioLogRequest(next.payload as CreateCardioLogInput);
        await offlineDb.pendingCardioLogs.delete(next.id as number);
        changed = true;
      } catch (error) {
        if (error instanceof ApiError && !isTransientFailure(error)) {
          // Rejected outright (validation, ...) — same handling as the other queues: keep it
          // visible with its payload in the sync panel instead of dropping it silently.
          console.error("Dropping unsyncable cardio log", next, error);
          await offlineDb.failedMutations.add({
            accountId,
            kind: "cardioLog",
            clientId: next.clientId,
            op: "create",
            payload: next.payload,
            label: next.label,
            reason: error.message,
            failedAt: new Date().toISOString(),
          });
          await offlineDb.pendingCardioLogs.delete(next.id as number);
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
    endSync();
    await refreshSyncCounts();
    if (changed) void queryClient.invalidateQueries({ queryKey: CARDIO_LOGS_QUERY_PREFIX });
  }
}

let listenersInitialized = false;
const RETRY_INTERVAL_MS = 60_000;

export function initCardioLogSync() {
  if (listenersInitialized) return;
  listenersInitialized = true;
  void refreshSyncCounts();
  window.addEventListener("online", () => void flushPendingCardioLogs());
  if (navigator.onLine) void flushPendingCardioLogs();
  setInterval(() => {
    if (navigator.onLine) void flushPendingCardioLogs();
  }, RETRY_INTERVAL_MS);
}
