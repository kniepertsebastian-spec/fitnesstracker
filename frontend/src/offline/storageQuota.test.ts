import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FakeOfflineDb } from "./testing/fakes";

vi.mock("./db", async () => {
  const { createFakeOfflineDb } = await import("./testing/fakes");
  return { offlineDb: createFakeOfflineDb() };
});
vi.mock("./exerciseImagePack", () => ({ clearPack: vi.fn().mockResolvedValue(undefined) }));

const { offlineDb } = await import("./db");
const db = offlineDb as unknown as FakeOfflineDb;
const { clearPack } = await import("./exerciseImagePack");
const { useStorageNoticeStore } = await import("../stores/storageNoticeStore");
const { STORAGE_FULL_MESSAGE, StorageQuotaError, isQuotaExceededError, writeWithQuotaRecovery } = await import(
  "./storageQuota"
);

const quotaError = () => new DOMException("The quota has been exceeded.", "QuotaExceededError");

beforeEach(async () => {
  db.reset();
  await db.queryCache.put({ key: "react-query", value: "{}" });
  vi.mocked(clearPack).mockClear();
  useStorageNoticeStore.getState().dismiss();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("isQuotaExceededError", () => {
  it("recognises the browser's error, Dexie's wrapped form and the legacy code", () => {
    expect(isQuotaExceededError(quotaError())).toBe(true);
    expect(isQuotaExceededError({ name: "AbortError", inner: { name: "QuotaExceededError" } })).toBe(true);
    expect(isQuotaExceededError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(isQuotaExceededError(new DOMException("legacy", "SomethingElse"))).toBe(false);
    expect(isQuotaExceededError(new Error("network"))).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });
});

describe("writeWithQuotaRecovery", () => {
  it("passes a successful write straight through", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    await expect(writeWithQuotaRecovery(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(await db.queryCache.count()).toBe(1);
    expect(clearPack).not.toHaveBeenCalled();
  });

  it("frees the caches and retries once when storage is full", async () => {
    const operation = vi.fn().mockRejectedValueOnce(quotaError()).mockResolvedValueOnce("saved");

    await expect(writeWithQuotaRecovery(operation)).resolves.toBe("saved");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(await db.queryCache.count()).toBe(0);
    expect(clearPack).toHaveBeenCalledTimes(1);
    expect(useStorageNoticeStore.getState().message).toBeNull();
  });

  it("keeps the exercise pictures when asked to", async () => {
    const operation = vi.fn().mockRejectedValueOnce(quotaError()).mockResolvedValueOnce(undefined);
    await writeWithQuotaRecovery(operation, { clearImageCache: false });
    expect(await db.queryCache.count()).toBe(0);
    expect(clearPack).not.toHaveBeenCalled();
  });

  it("gives up after the second attempt with a typed error and a message for the user", async () => {
    // The notice is rate-limited per half minute; a fresh clock keeps this test independent.
    vi.useFakeTimers({ now: Date.now() + 10 * 60_000, toFake: ["Date"] });
    const operation = vi.fn().mockRejectedValue(quotaError());

    const error = await writeWithQuotaRecovery(operation).catch((e: unknown) => e);

    expect(operation).toHaveBeenCalledTimes(2);
    expect(error).toBeInstanceOf(StorageQuotaError);
    expect((error as Error).message).toBe(STORAGE_FULL_MESSAGE);
    expect((error as Error).message).toContain("Speicher auf diesem Gerät ist voll");
    // A non-blocking toast, not window.alert.
    expect(useStorageNoticeStore.getState().message).toBe(STORAGE_FULL_MESSAGE);
  });

  it("shows the notice at most once per half minute", async () => {
    vi.useFakeTimers({ now: Date.now() + 20 * 60_000, toFake: ["Date"] });
    const operation = vi.fn().mockRejectedValue(quotaError());

    await writeWithQuotaRecovery(operation).catch(() => undefined);
    expect(useStorageNoticeStore.getState().message).toBe(STORAGE_FULL_MESSAGE);
    useStorageNoticeStore.getState().dismiss();

    await writeWithQuotaRecovery(operation).catch(() => undefined);
    expect(useStorageNoticeStore.getState().message).toBeNull();

    vi.setSystemTime(Date.now() + 31_000);
    await writeWithQuotaRecovery(operation).catch(() => undefined);
    expect(useStorageNoticeStore.getState().message).toBe(STORAGE_FULL_MESSAGE);
  });

  it("does not touch anything for other errors", async () => {
    const failure = new Error("constraint");
    const operation = vi.fn().mockRejectedValue(failure);

    await expect(writeWithQuotaRecovery(operation)).rejects.toBe(failure);

    expect(operation).toHaveBeenCalledTimes(1);
    expect(await db.queryCache.count()).toBe(1);
    expect(clearPack).not.toHaveBeenCalled();
  });
});
