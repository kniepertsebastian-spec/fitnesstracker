import type { CreateWorkoutSessionInput, WorkoutSessionStatus } from "@fitnesstracker/shared";
import {
  createWorkoutSessionRequest,
  getOpenWorkoutSessionRequest,
  updateWorkoutSessionRequest,
} from "../api/workoutSession.api";
import { ApiError } from "../api/client";
import { queryClient } from "../queryClient";
import { offlineDb, type LocalWorkoutSession, type MutationOp } from "./db";
import { refreshSyncCounts } from "./syncCounts";

export const WORKOUT_SESSION_QUERY_KEY = ["workout-session", "open"];

const OPEN_STATUSES: WorkoutSessionStatus[] = ["ACTIVE", "PAUSED"];

// Same collapsing behaviour as workoutLogSync's enqueueMutation, on its own queue table — a
// Start followed by a Pause before either ever synced collapses into one "create" carrying the
// latest status, no delete op needed since a session is never removed, only ended.
async function enqueueSessionMutation(clientId: string, op: MutationOp, payload: Record<string, unknown>) {
  await offlineDb.transaction("rw", offlineDb.pendingSessionMutations, async () => {
    const existing = await offlineDb.pendingSessionMutations.where("clientId").equals(clientId).first();
    const queuedAt = new Date().toISOString();

    if (existing) {
      await offlineDb.pendingSessionMutations.update(existing.id as number, {
        payload: { ...existing.payload, ...payload },
        queuedAt,
      });
      return;
    }

    await offlineDb.pendingSessionMutations.add({ clientId, op, payload, queuedAt });
  });

  await refreshSyncCounts();
}

// Local-only read of whichever session is currently open (ACTIVE/PAUSED) — at most one in normal
// use; picks the most recently updated if that's ever violated, same safety net as the backend.
async function readCachedOpenSession(): Promise<LocalWorkoutSession | null> {
  const sessions = await offlineDb.workoutSessions
    .filter((s) => OPEN_STATUSES.includes(s.status))
    .toArray();
  if (sessions.length === 0) return null;
  return sessions.reduce((latest, s) => (s.updatedAt > latest.updatedAt ? s : latest));
}

async function syncSessionQueryCache() {
  queryClient.setQueryData(WORKOUT_SESSION_QUERY_KEY, await readCachedOpenSession());
}

// Cache-then-network read, same pattern as fetchAndCacheWorkoutLogs: try the server first and
// merge into the local cache (skipping a session with an unsynced local mutation so a background
// refresh can't clobber it), then always serve from the cache.
export async function fetchAndCacheOpenSession(): Promise<LocalWorkoutSession | null> {
  try {
    const dto = await getOpenWorkoutSessionRequest();
    const pendingClientIds = new Set(
      (await offlineDb.pendingSessionMutations.toArray()).map((m) => m.clientId),
    );
    if (dto && !pendingClientIds.has(dto.clientId)) {
      await offlineDb.workoutSessions.put(dto);
    }
  } catch {
    // Offline or the request otherwise failed — fall through and serve what's cached.
  }
  return readCachedOpenSession();
}

export async function startWorkoutSessionLocal(clientId: string) {
  const now = new Date().toISOString();
  const local: LocalWorkoutSession = {
    id: null,
    clientId,
    status: "ACTIVE",
    startedAt: now,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await offlineDb.workoutSessions.put(local);
  const input: CreateWorkoutSessionInput = { clientId };
  await enqueueSessionMutation(clientId, "create", input);
  await syncSessionQueryCache();
  void flushPendingSessionMutations();
}

export async function updateWorkoutSessionStatusLocal(clientId: string, status: WorkoutSessionStatus) {
  const existing = await offlineDb.workoutSessions.get(clientId);
  const now = new Date().toISOString();
  if (existing) {
    await offlineDb.workoutSessions.put({
      ...existing,
      status,
      endedAt: status === "COMPLETED" || status === "ABORTED" ? now : existing.endedAt,
      updatedAt: now,
    });
  }
  await enqueueSessionMutation(clientId, "update", { status });
  await syncSessionQueryCache();
  void flushPendingSessionMutations();
}

async function applySessionMutation(mutation: { clientId: string; op: MutationOp; payload: Record<string, unknown> }) {
  if (mutation.op === "create") {
    const dto = await createWorkoutSessionRequest(mutation.payload as CreateWorkoutSessionInput);
    await offlineDb.workoutSessions.put(dto);
  } else {
    const dto = await updateWorkoutSessionRequest(mutation.clientId, {
      status: mutation.payload.status as WorkoutSessionStatus,
    });
    await offlineDb.workoutSessions.put(dto);
  }
}

let flushing = false;

// Same strictly-ordered, one-at-a-time drain as flushPendingMutations, on the session queue —
// a Start always reaches the server before a Pause queued against the same not-yet-synced
// session.
export async function flushPendingSessionMutations() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (;;) {
      const next = await offlineDb.pendingSessionMutations.orderBy("queuedAt").first();
      if (!next) break;

      try {
        await applySessionMutation(next);
        await offlineDb.pendingSessionMutations.delete(next.id as number);
      } catch (error) {
        if (error instanceof ApiError) {
          console.error("Dropping unsyncable workout session mutation", next, error);
          await offlineDb.failedMutations.add({
            kind: "workoutSession",
            clientId: next.clientId,
            op: next.op,
            reason: error.message,
            failedAt: new Date().toISOString(),
          });
          await offlineDb.pendingSessionMutations.delete(next.id as number);
          continue;
        }
        // Network failure — stop for now; the periodic retry and the next online event both
        // pick the rest of the queue back up.
        break;
      }
    }
  } finally {
    flushing = false;
    await refreshSyncCounts();
    await syncSessionQueryCache();
  }
}

let listenersInitialized = false;

const RETRY_INTERVAL_MS = 60_000;

// Called once on app boot, alongside initWorkoutLogSync — its own online/offline listeners are
// cheap and independent, no reason to thread session-flush calls through the log sync module.
// Same periodic-retry rationale as workoutLogSync.ts: an 'online' event only fires on an actual
// offline→online transition, not on recovery from a transient failure while nominally online.
export function initWorkoutSessionSync() {
  if (listenersInitialized) return;
  listenersInitialized = true;

  void refreshSyncCounts();

  window.addEventListener("online", () => void flushPendingSessionMutations());

  if (navigator.onLine) {
    void flushPendingSessionMutations();
  }

  setInterval(() => {
    if (navigator.onLine) void flushPendingSessionMutations();
  }, RETRY_INTERVAL_MS);
}
