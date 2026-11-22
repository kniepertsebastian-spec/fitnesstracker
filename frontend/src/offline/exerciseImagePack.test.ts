import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseDto } from "@fitnesstracker/shared";
import { downloadPack, type PackProgress } from "./exerciseImagePack";

const ORIGIN = "https://app.test";

const catalog = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ imageUrls: [`/api/exercise-images/${i}.webp`] })) as unknown as ExerciseDto[];

const quotaError = () => new DOMException("The quota has been exceeded.", "QuotaExceededError");

class FakeCache {
  stored = new Map<string, unknown>();
  put = vi.fn(async (url: string, response: unknown) => {
    this.stored.set(url, response);
  });
  async keys() {
    return [...this.stored.keys()].map((url) => ({ url }));
  }
}

let cache: FakeCache;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cache = new FakeCache();
  fetchMock = vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return { ok: true };
  });
  vi.stubGlobal("window", { location: { origin: ORIGIN } });
  vi.stubGlobal("caches", { open: async () => cache });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("downloadPack", () => {
  it("stores every missing picture and reports progress", async () => {
    const updates: PackProgress[] = [];
    const result = await downloadPack(catalog(5), (p) => updates.push(p), undefined, 2);

    expect(result).toEqual({ done: 5, total: 5, failed: 0, quotaExceeded: false });
    expect(cache.stored.size).toBe(5);
    expect(updates.at(-1)).toEqual(result);
  });

  it("stops the whole run as soon as the device is full", async () => {
    // The third picture no longer fits; everything after it would fail the same way.
    let puts = 0;
    cache.put.mockImplementation(async (url: string, response: unknown) => {
      puts += 1;
      if (puts >= 3) throw quotaError();
      cache.stored.set(url, response);
    });
    const updates: PackProgress[] = [];

    const result = await downloadPack(catalog(40), (p) => updates.push(p), undefined, 1);

    expect(result.quotaExceeded).toBe(true);
    expect(result.done).toBe(2);
    // Not counted as 38 "failed" pictures, and no further downloads after the full write.
    expect(result.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(updates.at(-1)?.quotaExceeded).toBe(true);
    // What was saved before stays.
    expect(cache.stored.size).toBe(2);
  });

  it("cancels downloads still in flight on the other workers when the storage is full", async () => {
    let calls = 0;
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(async (_url: string, init?: { signal?: AbortSignal }) => {
      calls += 1;
      if (init?.signal) signals.push(init.signal);
      return { ok: true };
    });
    cache.put.mockRejectedValue(quotaError());

    const result = await downloadPack(catalog(20), () => undefined, undefined, 4);

    expect(result.quotaExceeded).toBe(true);
    expect(calls).toBeLessThanOrEqual(4);
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it("still counts other failures and carries on", async () => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith("/1.webp") ? { ok: false } : { ok: true }));

    const result = await downloadPack(catalog(3), () => undefined, undefined, 1);

    expect(result).toEqual({ done: 3, total: 3, failed: 1, quotaExceeded: false });
  });

  it("stops when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await downloadPack(catalog(3), () => undefined, controller.signal, 1);

    expect(result.done).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
