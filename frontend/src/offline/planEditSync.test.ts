import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage, type FakeOfflineDb } from "./testing/fakes";

const account = vi.hoisted(() => ({ id: "acc-1" as string | null }));

vi.mock("./db", async () => {
  const { createFakeOfflineDb } = await import("./testing/fakes");
  return { offlineDb: createFakeOfflineDb() };
});
vi.mock("../queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn().mockResolvedValue(undefined) },
  clearQueryCache: vi.fn(),
}));
vi.mock("../api/planExercise.api", () => ({
  createPlanExerciseRequest: vi.fn(),
  deletePlanExerciseRequest: vi.fn(),
  updatePlanExerciseRequest: vi.fn(),
}));
vi.mock("./account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./account")>()),
  currentAccountId: () => account.id,
  lastKnownAccountId: () => account.id,
}));

const { offlineDb } = await import("./db");
const db = offlineDb as unknown as FakeOfflineDb;
const api = await import("../api/planExercise.api");
const { ApiError } = await import("../api/client");
const { useSyncStore } = await import("../stores/syncStore");
const { refreshSyncCounts } = await import("./syncCounts");
const { logoutWarnings } = await import("../lib/logoutWarning");
const { loadPlanEdits, savePlanEdits } = await import("../lib/planEdits");
const { enqueuePlanOp, flushPlanOps, pendingPlanOpsCount } = await import("./planEditSync");
const { PLAN_QUEUE_KEY } = await import("./planOpQueue");
const { discardFailedMutation, retryFailedMutation } = await import("./retry");

const storage = new MemoryStorage();
const net = { onLine: false };

function queueEntry(accountId: string, editId: string) {
  return { accountId, editId, sessionClientId: "session-1", op: { type: "delete", id: `pe-${editId}` } };
}

// A permanent "remove" edit in focus mode, as TrainingPage creates it together with its queued op.
function seedEdit(editId: string) {
  savePlanEdits("session-1", [{ id: editId, kind: "remove", key: `pe-${editId}`, permanent: true, synced: false }]);
}

beforeEach(() => {
  storage.clear();
  db.reset();
  account.id = "acc-1";
  net.onLine = false;
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("navigator", net);
  vi.stubGlobal("window", new EventTarget());
  vi.mocked(api.deletePlanExerciseRequest).mockReset();
  useSyncStore.setState({ pendingCount: 0, failedMutations: [], failedCount: 0, isSyncing: false });
});
afterEach(() => vi.unstubAllGlobals());

describe("pendingPlanOpsCount", () => {
  it("counts only the signed-in account's queued plan changes", () => {
    storage.setItem(
      PLAN_QUEUE_KEY,
      JSON.stringify([queueEntry("acc-1", "e1"), queueEntry("acc-2", "e2"), queueEntry("acc-1", "e3")]),
    );
    expect(pendingPlanOpsCount()).toBe(2);
    expect(pendingPlanOpsCount("acc-2")).toBe(1);
    account.id = null;
    expect(pendingPlanOpsCount()).toBe(0);
  });

  it("is part of the pending count next to queued sets", async () => {
    storage.setItem(PLAN_QUEUE_KEY, JSON.stringify([queueEntry("acc-1", "e1")]));
    await db.pendingMutations.add({ accountId: "acc-1", clientId: "log-1", op: "create", payload: {}, queuedAt: "x" });
    await refreshSyncCounts();
    expect(useSyncStore.getState().pendingCount).toBe(2);
  });

  it("raises the counter for an offline plan change, which the logout warning picks up", async () => {
    seedEdit("e1");
    enqueuePlanOp({ editId: "e1", sessionClientId: "session-1", op: { type: "delete", id: "pe-e1" } });
    await vi.waitFor(() => expect(useSyncStore.getState().pendingCount).toBe(1));
    expect(api.deletePlanExerciseRequest).not.toHaveBeenCalled();

    const { pendingCount, failedCount } = useSyncStore.getState();
    const warnings = logoutWarnings({ isOnline: false, pendingCount, failedCount });
    expect(warnings[0]).toContain("1 Eintrag ist noch nicht synchronisiert");
  });
});

describe("flushPlanOps", () => {
  it("reports syncing while it sends and ends it afterwards", async () => {
    storage.setItem(PLAN_QUEUE_KEY, JSON.stringify([queueEntry("acc-1", "e1")]));
    seedEdit("e1");
    net.onLine = true;
    let syncingDuringSend = false;
    vi.mocked(api.deletePlanExerciseRequest).mockImplementation(async () => {
      syncingDuringSend = useSyncStore.getState().isSyncing;
    });

    await flushPlanOps();

    expect(syncingDuringSend).toBe(true);
    expect(useSyncStore.getState().isSyncing).toBe(false);
    expect(pendingPlanOpsCount()).toBe(0);
    expect(loadPlanEdits("session-1")[0]).toMatchObject({ synced: true, permanent: true });
  });

  it("keeps a change queued when the server is only temporarily unavailable", async () => {
    storage.setItem(PLAN_QUEUE_KEY, JSON.stringify([queueEntry("acc-1", "e1")]));
    net.onLine = true;
    vi.mocked(api.deletePlanExerciseRequest).mockRejectedValue(new ApiError(503, "Service Unavailable"));

    await flushPlanOps();

    expect(pendingPlanOpsCount()).toBe(1);
    expect(await db.failedMutations.count()).toBe(0);
    expect(useSyncStore.getState().isSyncing).toBe(false);
  });

  it("moves a change the server rejects into the failed list instead of only logging it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    storage.setItem(PLAN_QUEUE_KEY, JSON.stringify([queueEntry("acc-1", "e1")]));
    seedEdit("e1");
    net.onLine = true;
    vi.mocked(api.deletePlanExerciseRequest).mockRejectedValue(new ApiError(404, "Der Planeintrag wurde nicht gefunden."));

    await flushPlanOps();

    expect(pendingPlanOpsCount()).toBe(0);
    const [failed] = await db.failedMutations.toArray();
    expect(failed).toMatchObject({
      accountId: "acc-1",
      kind: "planEdit",
      clientId: "e1",
      op: "delete",
      label: "Plan: Übung entfernt",
      reason: "Der Planeintrag wurde nicht gefunden.",
    });
    expect(failed.payload).toMatchObject({ editId: "e1", sessionClientId: "session-1", op: { type: "delete", id: "pe-e1" } });
    expect(useSyncStore.getState().failedCount).toBe(1);
    // Still applied today, just not in the plan.
    expect(loadPlanEdits("session-1")[0]).toMatchObject({ permanent: false, synced: false });
  });
});

describe("failed plan changes", () => {
  async function rejectOnce() {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    storage.setItem(PLAN_QUEUE_KEY, JSON.stringify([queueEntry("acc-1", "e1")]));
    seedEdit("e1");
    net.onLine = true;
    vi.mocked(api.deletePlanExerciseRequest).mockRejectedValueOnce(new ApiError(409, "Conflict"));
    await flushPlanOps();
    const [failed] = useSyncStore.getState().failedMutations;
    expect(failed?.kind).toBe("planEdit");
    return failed!;
  }

  it("can be sent again and then count as part of the plan", async () => {
    const failed = await rejectOnce();
    vi.mocked(api.deletePlanExerciseRequest).mockResolvedValue(undefined as never);

    await retryFailedMutation(failed);
    await vi.waitFor(() => expect(api.deletePlanExerciseRequest).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(loadPlanEdits("session-1")[0]).toMatchObject({ permanent: true, synced: true }));

    expect(await db.failedMutations.count()).toBe(0);
    expect(pendingPlanOpsCount()).toBe(0);
    expect(useSyncStore.getState().failedCount).toBe(0);
  });

  it("can be discarded", async () => {
    const failed = await rejectOnce();

    await discardFailedMutation(failed);

    expect(await db.failedMutations.count()).toBe(0);
    expect(useSyncStore.getState().failedCount).toBe(0);
    expect(pendingPlanOpsCount()).toBe(0);
  });
});
