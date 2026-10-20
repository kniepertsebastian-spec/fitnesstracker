import type { CreateWorkoutLogInput, UpdateWorkoutLogInput } from "@fitnesstracker/shared";
import {
  createWorkoutLogRequest,
  deleteWorkoutLogRequest,
  listWorkoutLogsRequest,
  updateWorkoutLogRequest,
} from "../api/workoutLog.api";
import { ApiError } from "../api/client";
import { beginSync, endSync, useSyncStore } from "../stores/syncStore";
import { queryClient } from "../queryClient";
import { useAuthStore } from "../stores/authStore";
import { offlineDb, type LocalWorkoutLog, type MutationOp } from "./db";
import { refreshSyncCounts } from "./syncCounts";

export const WORKOUT_LOGS_QUERY_KEY = ["workout-logs"] as const;

// Keeps at most one queued mutation per row: a create followed by edits before it ever syncs
// stays a single "create" carrying the latest values, rather than replaying every intermediate
// step once back online.
async function enqueueMutation(accountId: string, clientId: string, op: MutationOp, payload: Record<string, unknown>) {
  await offlineDb.transaction("rw", offlineDb.pendingMutations, async () => {
    const existing = await offlineDb.pendingMutations.where("accountId").equals(accountId).filter((m) => m.clientId === clientId).first();
    const queuedAt = new Date().toISOString();

    if (op === "delete") {
      if (existing) {
        await offlineDb.pendingMutations.delete(existing.id as number);
        if (existing.op === "create") {
          // Never synced — there's nothing for the server to delete.
          return;
        }
      }
      await offlineDb.pendingMutations.add({ accountId, clientId, op: "delete", payload: {}, queuedAt });
      return;
    }

    if (existing) {
      await offlineDb.pendingMutations.update(existing.id as number, {
        payload: { ...existing.payload, ...payload },
        queuedAt,
      });
      return;
    }

    await offlineDb.pendingMutations.add({ accountId, clientId, op, payload, queuedAt });
  });

  await refreshSyncCounts();
}

// Local-only read, deliberately never touches the network — used to refresh the UI right after
// a mutation so the dialog closes and the table updates instantly even while offline, instead
// of waiting on a doomed-while-offline refetch (see fetchAndCacheWorkoutLogs for that one).
async function readCachedWorkoutLogs(accountId: string): Promise<LocalWorkoutLog[]> {
  const logs = await offlineDb.workoutLogs.where("accountId").equals(accountId).toArray();
  return logs.sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1));
}

// Pushes the current local cache straight into the query cache — no network involved, so this
// is safe to call after every local write and after every background sync step alike, and it
// works even when nothing in the React tree triggered it (the online-event flush in particular).
async function syncQueryCache(accountId: string) {
  queryClient.setQueryData([...WORKOUT_LOGS_QUERY_KEY, accountId], await readCachedWorkoutLogs(accountId));
  // A logged/edited/deleted set can change which split day counts as "trained this week" (see
  // planWeekStatus.service.ts) — invalidate across all three phases rather than trying to know
  // which one is "current" from here; the query is cheap and rarely open in more than one tab.
  queryClient.invalidateQueries({ queryKey: ["plan-exercises", "week-status"] });
}

// Delta sync (roadmap3 P2.1): after the first full download only what changed since the last
// sync is fetched — a few rows instead of years of history on every app start. The cursor is the
// server's own clock (`serverTime` of the previous response), kept per account in localStorage.
// A full download still happens for a new device/account, an empty local cache and once a day,
// as a safety net for anything a delta might not express.
const SYNC_OVERLAP_MS = 5_000; // re-ask slightly back: covers rows committed while the last request ran
const FULL_RESYNC_AFTER_MS = 24 * 60 * 60 * 1000;

interface SyncState {
  serverTime: string;
  fullAt: number;
}

const syncStateKey = (accountId: string) => `fitnesstracker.workout-logs-sync.${accountId}`;

function readSyncState(accountId: string): SyncState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(syncStateKey(accountId)) ?? "null") as SyncState | null;
    return parsed && typeof parsed.serverTime === "string" && typeof parsed.fullAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSyncState(accountId: string, state: SyncState) {
  try {
    localStorage.setItem(syncStateKey(accountId), JSON.stringify(state));
  } catch {
    // Without storage every load is simply a full download again.
  }
}

async function pendingClientIdsFor(accountId: string): Promise<Set<string>> {
  return new Set(
    (await offlineDb.pendingMutations.where("accountId").equals(accountId).toArray()).map((m) => m.clientId),
  );
}

async function applyFullDownload(accountId: string) {
  // Rows already synced before the request: the list (the account's complete history) must
  // contain them, so one missing from it was deleted on another device (roadmap3 P1.4) —
  // without this it would linger here forever and skew "Letztes Mal", PRs and volume. Taken
  // before the request on purpose: a row that syncs while it's in flight isn't in the list yet
  // and must not be mistaken for a deletion.
  const syncedBefore = new Set(
    (await offlineDb.workoutLogs.where("accountId").equals(accountId).toArray())
      .filter((row) => row.id !== null)
      .map((row) => row.clientId),
  );
  const { items, serverTime } = await listWorkoutLogsRequest();
  const pendingClientIds = await pendingClientIdsFor(accountId);
  const serverClientIds = new Set(items.map((dto) => dto.clientId));
  await offlineDb.transaction("rw", offlineDb.workoutLogs, async () => {
    const stale = [...syncedBefore].filter((id) => !serverClientIds.has(id) && !pendingClientIds.has(id));
    await offlineDb.workoutLogs.bulkDelete(stale);
    await offlineDb.workoutLogs.bulkPut(
      items.filter((dto) => !pendingClientIds.has(dto.clientId)).map((dto) => ({ ...dto, accountId })),
    );
  });
  if (serverTime) writeSyncState(accountId, { serverTime, fullAt: Date.now() });
}

async function applyDelta(accountId: string, state: SyncState) {
  const since = new Date(new Date(state.serverTime).getTime() - SYNC_OVERLAP_MS).toISOString();
  const { items, deletedClientIds, serverTime } = await listWorkoutLogsRequest(since);
  const pendingClientIds = await pendingClientIdsFor(accountId);
  await offlineDb.transaction("rw", offlineDb.workoutLogs, async () => {
    await offlineDb.workoutLogs.bulkDelete((deletedClientIds ?? []).filter((id) => !pendingClientIds.has(id)));
    await offlineDb.workoutLogs.bulkPut(
      items.filter((dto) => !pendingClientIds.has(dto.clientId)).map((dto) => ({ ...dto, accountId })),
    );
  });
  // Keep the old cursor (and `fullAt`) if the server didn't send one — the next load re-asks.
  if (serverTime) writeSyncState(accountId, { serverTime, fullAt: state.fullAt });
}

// Cache-then-network read: tries the API first and merges the result into the local cache
// (skipping rows with a not-yet-synced local mutation, so a background refresh can't clobber
// an edit the server hasn't seen yet), then always serves from the cache — offline just means
// the network step is skipped and the previous cache contents are returned as-is.
export async function fetchAndCacheWorkoutLogs(accountId: string): Promise<LocalWorkoutLog[]> {
  if (!accountId || useAuthStore.getState().user?.id !== accountId) return [];
  try {
    const state = readSyncState(accountId);
    const cachedCount = await offlineDb.workoutLogs.where("accountId").equals(accountId).count();
    if (state && cachedCount > 0 && Date.now() - state.fullAt < FULL_RESYNC_AFTER_MS) {
      await applyDelta(accountId, state);
    } else {
      await applyFullDownload(accountId);
    }
  } catch {
    // Offline or the request otherwise failed — fall through and serve what's cached.
  }
  return readCachedWorkoutLogs(accountId);
}

export async function createWorkoutLogLocal(input: CreateWorkoutLogInput, exerciseName: string) {
  const accountId = useAuthStore.getState().user?.id;
  if (!accountId) throw new Error("Zum Speichern muss ein Account angemeldet sein.");
  const now = new Date().toISOString();
  const local: LocalWorkoutLog = {
    id: null,
    accountId,
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
  await enqueueMutation(accountId, input.clientId, "create", input);
  await syncQueryCache(accountId);
  void flushPendingMutations(accountId);
}

export async function updateWorkoutLogLocal(
  clientId: string,
  input: UpdateWorkoutLogInput,
  exerciseName: string | undefined,
) {
  const accountId = useAuthStore.getState().user?.id;
  if (!accountId) throw new Error("Zum Bearbeiten muss ein Account angemeldet sein.");
  const existing = await offlineDb.workoutLogs.get(clientId);
  if (!existing || existing.accountId !== accountId) return;
  if (existing) {
    await offlineDb.workoutLogs.put({
      ...existing,
      ...input,
      exerciseName: exerciseName ?? existing.exerciseName,
      updatedAt: new Date().toISOString(),
    });
  }
  await enqueueMutation(accountId, clientId, "update", input);
  await syncQueryCache(accountId);
  void flushPendingMutations(accountId);
}

export async function deleteWorkoutLogLocal(clientId: string) {
  const accountId = useAuthStore.getState().user?.id;
  if (!accountId) throw new Error("Zum Löschen muss ein Account angemeldet sein.");
  const existing = await offlineDb.workoutLogs.get(clientId);
  if (!existing || existing.accountId !== accountId) return;
  await offlineDb.workoutLogs.delete(clientId);
  await enqueueMutation(accountId, clientId, "delete", {});
  await syncQueryCache(accountId);
  void flushPendingMutations(accountId);
}

async function applyMutation(mutation: { accountId: string; clientId: string; op: MutationOp; payload: Record<string, unknown> }) {
  if (mutation.op === "create") {
    const dto = await createWorkoutLogRequest(mutation.payload as CreateWorkoutLogInput);
    await offlineDb.workoutLogs.put({ ...dto, accountId: mutation.accountId });
  } else if (mutation.op === "update") {
    const dto = await updateWorkoutLogRequest(mutation.clientId, mutation.payload as UpdateWorkoutLogInput);
    await offlineDb.workoutLogs.put({ ...dto, accountId: mutation.accountId });
  } else {
    await deleteWorkoutLogRequest(mutation.clientId);
  }
}

let flushing = false;

// Processes the queue strictly in the order mutations were made, one at a time, so e.g. a
// create always reaches the server before an edit queued against the same (still unsynced) row.
export async function flushPendingMutations(accountId = useAuthStore.getState().user?.id) {
  if (flushing || !navigator.onLine || !accountId) return;
  flushing = true;
  beginSync();
  try {
    for (;;) {
      if (useAuthStore.getState().user?.id !== accountId) break;
      const queue = await offlineDb.pendingMutations.where("accountId").equals(accountId).sortBy("queuedAt");
      const next = queue[0];
      if (!next) break;

      try {
        await applyMutation({ ...next, accountId });
        await offlineDb.pendingMutations.delete(next.id as number);
      } catch (error) {
        if (error instanceof ApiError) {
          // The server rejected it outright (validation, 404 after manual deletion elsewhere,
          // ...) — retrying the exact same request won't change that, so drop it rather than
          // blocking everything queued after it. Recorded in failedMutations (payload included)
          // rather than just console.error'd, so it shows up in the sync status panel with a
          // manual retry option (offline/retry.ts) instead of the entry just silently vanishing.
          console.error("Dropping unsyncable workout log mutation", next, error);
          // A delete's local row is already gone by now (deleteWorkoutLogLocal removes it
          // immediately, optimistically) — fall back to a generic label in that case.
          const localRow = await offlineDb.workoutLogs.get(next.clientId);
          await offlineDb.failedMutations.add({
            accountId,
            kind: "workoutLog",
            clientId: next.clientId,
            op: next.op,
            payload: next.payload,
            label: localRow?.exerciseName ?? "Satz",
            reason: error.message,
            failedAt: new Date().toISOString(),
          });
          await offlineDb.pendingMutations.delete(next.id as number);
          continue;
        }
        // Network failure — stop for now; the periodic retry and the next online event both
        // pick the rest of the queue back up.
        break;
      }
    }
  } finally {
    flushing = false;
    endSync();
    await refreshSyncCounts();
    if (useAuthStore.getState().user?.id === accountId) await syncQueryCache(accountId);
  }
}

let listenersInitialized = false;

// Called once on app boot. Reconciles pendingCount on load and wires the online/offline events
// that drive the sync manager — no Background Sync API, since iOS Safari doesn't support it.
// Also retries periodically while online: an 'online' event only fires on an actual
// offline→online transition, so a sync that failed for another reason (the backend briefly
// down, a slow/erroring request) while the browser stayed "online" the whole time would
// otherwise sit stuck until the next local mutation or app reload.
const RETRY_INTERVAL_MS = 60_000;

export function initWorkoutLogSync() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  useSyncStore.getState().setOnline(navigator.onLine);
  void refreshSyncCounts();

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

  setInterval(() => {
    if (navigator.onLine) void flushPendingMutations();
  }, RETRY_INTERVAL_MS);
}
