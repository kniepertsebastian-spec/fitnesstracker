import type { CreateWorkoutLogInput, UpdateWorkoutLogInput } from "@fitnesstracker/shared";
import {
  createWorkoutLogRequest,
  deleteWorkoutLogRequest,
  listWorkoutLogsRequest,
  updateWorkoutLogRequest,
} from "../api/workoutLog.api";
import { ApiError } from "../api/client";
import { useSyncStore } from "../stores/syncStore";
import { queryClient } from "../queryClient";
import { offlineDb, type LocalWorkoutLog, type MutationOp } from "./db";

export const WORKOUT_LOGS_QUERY_KEY = ["workout-logs"];

async function refreshPendingCount() {
  const count = await offlineDb.pendingMutations.count();
  useSyncStore.getState().setPendingCount(count);
}

// Keeps at most one queued mutation per row: a create followed by edits before it ever syncs
// stays a single "create" carrying the latest values, rather than replaying every intermediate
// step once back online.
async function enqueueMutation(clientId: string, op: MutationOp, payload: Record<string, unknown>) {
  await offlineDb.transaction("rw", offlineDb.pendingMutations, async () => {
    const existing = await offlineDb.pendingMutations.where("clientId").equals(clientId).first();
    const queuedAt = new Date().toISOString();

    if (op === "delete") {
      if (existing) {
        await offlineDb.pendingMutations.delete(existing.id as number);
        if (existing.op === "create") {
          // Never synced — there's nothing for the server to delete.
          return;
        }
      }
      await offlineDb.pendingMutations.add({ clientId, op: "delete", payload: {}, queuedAt });
      return;
    }

    if (existing) {
      await offlineDb.pendingMutations.update(existing.id as number, {
        payload: { ...existing.payload, ...payload },
        queuedAt,
      });
      return;
    }

    await offlineDb.pendingMutations.add({ clientId, op, payload, queuedAt });
  });

  await refreshPendingCount();
}

// Local-only read, deliberately never touches the network — used to refresh the UI right after
// a mutation so the dialog closes and the table updates instantly even while offline, instead
// of waiting on a doomed-while-offline refetch (see fetchAndCacheWorkoutLogs for that one).
async function readCachedWorkoutLogs(): Promise<LocalWorkoutLog[]> {
  const logs = await offlineDb.workoutLogs.toArray();
  return logs.sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1));
}

// Pushes the current local cache straight into the query cache — no network involved, so this
// is safe to call after every local write and after every background sync step alike, and it
// works even when nothing in the React tree triggered it (the online-event flush in particular).
async function syncQueryCache() {
  queryClient.setQueryData(WORKOUT_LOGS_QUERY_KEY, await readCachedWorkoutLogs());
}

// Cache-then-network read: tries the API first and merges the result into the local cache
// (skipping rows with a not-yet-synced local mutation, so a background refresh can't clobber
// an edit the server hasn't seen yet), then always serves from the cache — offline just means
// the network step is skipped and the previous cache contents are returned as-is.
export async function fetchAndCacheWorkoutLogs(): Promise<LocalWorkoutLog[]> {
  try {
    const { items } = await listWorkoutLogsRequest();
    const pendingClientIds = new Set(
      (await offlineDb.pendingMutations.toArray()).map((m) => m.clientId),
    );
    await offlineDb.transaction("rw", offlineDb.workoutLogs, async () => {
      for (const dto of items) {
        if (!pendingClientIds.has(dto.clientId)) {
          await offlineDb.workoutLogs.put(dto);
        }
      }
    });
  } catch {
    // Offline or the request otherwise failed — fall through and serve what's cached.
  }
  return readCachedWorkoutLogs();
}

export async function createWorkoutLogLocal(input: CreateWorkoutLogInput, exerciseName: string) {
  const now = new Date().toISOString();
  const local: LocalWorkoutLog = {
    id: null,
    clientId: input.clientId,
    exerciseId: input.exerciseId,
    exerciseName,
    setNumber: input.setNumber,
    reps: input.reps,
    weightKg: input.weightKg,
    rir: input.rir ?? null,
    supersetGroupId: input.supersetGroupId ?? null,
    performedAt: input.performedAt ?? now,
    createdAt: now,
    updatedAt: now,
  };
  await offlineDb.workoutLogs.put(local);
  await enqueueMutation(input.clientId, "create", input);
  await syncQueryCache();
  void flushPendingMutations();
}

export async function updateWorkoutLogLocal(
  clientId: string,
  input: UpdateWorkoutLogInput,
  exerciseName: string | undefined,
) {
  const existing = await offlineDb.workoutLogs.get(clientId);
  if (existing) {
    await offlineDb.workoutLogs.put({
      ...existing,
      ...input,
      exerciseName: exerciseName ?? existing.exerciseName,
      updatedAt: new Date().toISOString(),
    });
  }
  await enqueueMutation(clientId, "update", input);
  await syncQueryCache();
  void flushPendingMutations();
}

export async function deleteWorkoutLogLocal(clientId: string) {
  await offlineDb.workoutLogs.delete(clientId);
  await enqueueMutation(clientId, "delete", {});
  await syncQueryCache();
  void flushPendingMutations();
}

async function applyMutation(mutation: { clientId: string; op: MutationOp; payload: Record<string, unknown> }) {
  if (mutation.op === "create") {
    const dto = await createWorkoutLogRequest(mutation.payload as CreateWorkoutLogInput);
    await offlineDb.workoutLogs.put(dto);
  } else if (mutation.op === "update") {
    const dto = await updateWorkoutLogRequest(mutation.clientId, mutation.payload as UpdateWorkoutLogInput);
    await offlineDb.workoutLogs.put(dto);
  } else {
    await deleteWorkoutLogRequest(mutation.clientId);
  }
}

let flushing = false;

// Processes the queue strictly in the order mutations were made, one at a time, so e.g. a
// create always reaches the server before an edit queued against the same (still unsynced) row.
export async function flushPendingMutations() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (;;) {
      const next = await offlineDb.pendingMutations.orderBy("queuedAt").first();
      if (!next) break;

      try {
        await applyMutation(next);
        await offlineDb.pendingMutations.delete(next.id as number);
      } catch (error) {
        if (error instanceof ApiError) {
          // The server rejected it outright (validation, 404 after manual deletion elsewhere,
          // ...) — retrying won't change that, so drop it rather than blocking everything
          // queued after it.
          console.error("Dropping unsyncable workout log mutation", next, error);
          await offlineDb.pendingMutations.delete(next.id as number);
          continue;
        }
        // Network failure — stop for now, the rest of the queue waits for the next online event.
        break;
      }
    }
  } finally {
    flushing = false;
    await refreshPendingCount();
    await syncQueryCache();
  }
}

let listenersInitialized = false;

// Called once on app boot. Reconciles pendingCount on load and wires the online/offline events
// that drive the sync manager — no Background Sync API, since iOS Safari doesn't support it.
export function initWorkoutLogSync() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  useSyncStore.getState().setOnline(navigator.onLine);
  void refreshPendingCount();

  window.addEventListener("online", () => {
    useSyncStore.getState().setOnline(true);
    void flushPendingMutations();
  });
  window.addEventListener("offline", () => {
    useSyncStore.getState().setOnline(false);
  });

  if (navigator.onLine) {
    void flushPendingMutations();
  }
}
