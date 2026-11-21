import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage, type FakeOfflineDb } from "./testing/fakes";

const account = vi.hoisted(() => ({ lastKnown: "acc-1" as string | null }));

vi.mock("./db", async () => {
  const { createFakeOfflineDb } = await import("./testing/fakes");
  return { offlineDb: createFakeOfflineDb() };
});
vi.mock("../queryClient", () => ({ queryClient: {}, clearQueryCache: vi.fn() }));
vi.mock("./syncCounts", () => ({ refreshSyncCounts: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./account")>()),
  currentAccountId: () => "acc-1",
  lastKnownAccountId: () => account.lastKnown,
}));

const { offlineDb } = await import("./db");
const db = offlineDb as unknown as FakeOfflineDb;
const { purgeAccountLocalData } = await import("./purgeAccountLocalData");
const { PLAN_QUEUE_KEY } = await import("./planOpQueue");

const storage = new MemoryStorage();

const ACCOUNT_TABLES = [
  "workoutLogs",
  "pendingMutations",
  "workoutSessions",
  "pendingSessionMutations",
  "failedMutations",
  "pendingCardioLogs",
  "exerciseCatalog",
] as const;

async function seed() {
  for (const name of ACCOUNT_TABLES) {
    const table = db.table(name);
    const keyField = name === "exerciseCatalog" ? "id" : "clientId";
    for (const owner of ["acc-1", "acc-2", undefined]) {
      await table.add({ [keyField]: `${name}-${owner ?? "legacy"}`, ...(owner ? { accountId: owner } : {}) });
    }
  }
  await db.queryCache.put({ key: "react-query", value: '{"plan":"…"}' });
  await db.customSounds.put({ key: "timer", name: "gong.mp3" });
  await db.catalogMeta.put({ key: "catalog-version:acc-1", value: "v1" });
  await db.catalogMeta.put({ key: "catalog-version:acc-2", value: "v1" });

  storage.setItem("fitnesstracker.workout-logs-sync.acc-1", "{}");
  storage.setItem("fitnesstracker.workout-logs-sync.acc-2", "{}");
  storage.setItem(
    PLAN_QUEUE_KEY,
    JSON.stringify([
      { accountId: "acc-1", editId: "e1", sessionClientId: "s1", op: { type: "delete", id: "p1" } },
      { accountId: "acc-2", editId: "e2", sessionClientId: "s2", op: { type: "delete", id: "p2" } },
    ]),
  );
  storage.setItem("fitnesstracker.training-edits.s1", "[]");
  storage.setItem("training-stages:s1", "{}");
  storage.setItem("training-stretch:s1", "[]");
  storage.setItem("training-prestretch:s1", "[]");
  storage.setItem("stopwatch:cardio:0", "{}");
  storage.setItem("stretch-focus", "legs");
  storage.setItem("stretch-done:2026-11-21:all", "[]");
  storage.setItem("weightStep:Bankdrücken", "5");
  storage.setItem("progress-chart", "{}");
  storage.setItem("phase-template-dismissed", "[]");
  // Device settings, not account data.
  storage.setItem("fitnesstracker-rest-timer", "{}");
  storage.setItem("fitnesstracker.storage-persist-asked-at", "1");
}

beforeEach(() => {
  storage.clear();
  db.reset();
  account.lastKnown = "acc-1";
  vi.stubGlobal("localStorage", storage);
});
afterEach(() => vi.unstubAllGlobals());

describe("purgeAccountLocalData", () => {
  it("removes every trace of the deleted account from IndexedDB and localStorage", async () => {
    await seed();

    await purgeAccountLocalData("acc-1");

    for (const name of ACCOUNT_TABLES) {
      const owners = (await db.table(name).toArray()).map((row) => row.accountId);
      expect(owners, name).toEqual(["acc-2"]);
    }
    expect(await db.queryCache.count()).toBe(0);
    expect(await db.customSounds.count()).toBe(0);
    expect((await db.catalogMeta.toArray()).map((r) => r.key)).toEqual(["catalog-version:acc-2"]);

    expect(storage.keys().sort()).toEqual(
      [
        "fitnesstracker-rest-timer",
        "fitnesstracker.storage-persist-asked-at",
        "fitnesstracker.workout-logs-sync.acc-2",
        PLAN_QUEUE_KEY,
      ].sort(),
    );
    const queue = JSON.parse(storage.getItem(PLAN_QUEUE_KEY) ?? "[]") as { accountId: string }[];
    expect(queue.map((q) => q.accountId)).toEqual(["acc-2"]);
  });

  it("leaves rows without an account alone when they belong to whoever signed in last", async () => {
    await seed();
    account.lastKnown = "acc-2";

    await purgeAccountLocalData("acc-1");

    const owners = (await db.workoutLogs.toArray()).map((row) => row.accountId ?? "legacy").sort();
    expect(owners).toEqual(["acc-2", "legacy"]);
  });

  it("drops the plan queue key once nothing is left in it", async () => {
    storage.setItem(
      PLAN_QUEUE_KEY,
      JSON.stringify([{ accountId: "acc-1", editId: "e1", sessionClientId: "s1", op: { type: "delete", id: "p1" } }]),
    );

    await purgeAccountLocalData("acc-1");

    expect(storage.getItem(PLAN_QUEUE_KEY)).toBeNull();
  });
});
