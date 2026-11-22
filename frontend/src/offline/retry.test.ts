import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeOfflineDb } from "./testing/fakes";
import type { FailedMutation } from "./db";

vi.mock("./db", async () => {
  const { createFakeOfflineDb } = await import("./testing/fakes");
  return { offlineDb: createFakeOfflineDb() };
});
vi.mock("./exerciseImagePack", () => ({ clearPack: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./syncCounts", () => ({ refreshSyncCounts: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./workoutLogSync", () => ({ flushPendingMutations: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./workoutSessionSync", () => ({ flushPendingSessionMutations: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./cardioLogSync", () => ({ flushPendingCardioLogs: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./planEditSync", () => ({ requeueFailedPlanOp: vi.fn().mockResolvedValue(undefined) }));

const { offlineDb } = await import("./db");
const db = offlineDb as unknown as FakeOfflineDb;
const { retryFailedMutation } = await import("./retry");
const { StorageQuotaError } = await import("./storageQuota");
const { flushPendingMutations } = await import("./workoutLogSync");

const quotaError = () => new DOMException("The quota has been exceeded.", "QuotaExceededError");

async function seedFailed(overrides: Partial<FailedMutation> = {}): Promise<FailedMutation> {
  const failed: FailedMutation = {
    accountId: "acc-1",
    kind: "workoutLog",
    clientId: "log-1",
    op: "create",
    payload: { reps: 8 },
    label: "Bankdrücken",
    reason: "Server nicht erreichbar",
    failedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
  const id = (await db.failedMutations.add(failed as unknown as Record<string, unknown>)) as number;
  return { ...failed, id };
}

beforeEach(() => {
  db.reset();
  vi.restoreAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("retryFailedMutation", () => {
  it("re-queues the entry and removes it from the failed list", async () => {
    const failed = await seedFailed();

    await retryFailedMutation(failed);

    expect(await db.pendingMutations.toArray()).toEqual([
      expect.objectContaining({ accountId: "acc-1", clientId: "log-1", op: "create", payload: { reps: 8 } }),
    ]);
    expect(await db.failedMutations.count()).toBe(0);
    expect(flushPendingMutations).toHaveBeenCalled();
  });

  it("frees cached copies and retries once when the device is full", async () => {
    const failed = await seedFailed();
    await db.queryCache.put({ key: "react-query", value: "{}" });
    const add = db.pendingMutations.add.bind(db.pendingMutations);
    vi.spyOn(db.pendingMutations, "add").mockRejectedValueOnce(quotaError()).mockImplementation(add);

    await retryFailedMutation(failed);

    expect(await db.queryCache.count()).toBe(0);
    expect(await db.pendingMutations.count()).toBe(1);
    expect(await db.failedMutations.count()).toBe(0);
  });

  it("keeps the failed entry when it still doesn't fit", async () => {
    const failed = await seedFailed({ kind: "cardioLog", clientId: "cardio-1" });
    vi.spyOn(db.pendingCardioLogs, "add").mockRejectedValue(quotaError());

    await expect(retryFailedMutation(failed)).rejects.toBeInstanceOf(StorageQuotaError);

    expect(await db.pendingCardioLogs.count()).toBe(0);
    // Nothing is lost: the entry stays in the failed list for a later retry.
    expect(await db.failedMutations.count()).toBe(1);
  });
});
