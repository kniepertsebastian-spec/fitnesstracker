import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingLogout, flushPendingLogout, hasPendingLogout, markPendingLogout } from "./pendingLogout";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("pending logout", () => {
  it("is a no-op when nothing is pending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await flushPendingLogout()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays pending while the server cannot be reached", async () => {
    markPendingLogout();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await flushPendingLogout()).toBe(false);
    expect(hasPendingLogout()).toBe(true);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    expect(await flushPendingLogout()).toBe(false);
    expect(hasPendingLogout()).toBe(true);
  });

  it("is cleared once the server has processed the logout", async () => {
    markPendingLogout();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await flushPendingLogout()).toBe(true);
    expect(hasPendingLogout()).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST", credentials: "include" });
  });

  it("gives up on a rejected request instead of retrying forever", async () => {
    markPendingLogout();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 400 })));
    expect(await flushPendingLogout()).toBe(true);
    clearPendingLogout();
    expect(hasPendingLogout()).toBe(false);
  });
});
