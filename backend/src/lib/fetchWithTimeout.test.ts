import { afterEach, describe, expect, it, vi } from "vitest";
import { describeFetchError, fetchWithTimeout, isTimeoutError } from "./fetchWithTimeout.js";

afterEach(() => vi.unstubAllGlobals());

describe("fetchWithTimeout", () => {
  it("aborts a request that outlives its deadline", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const error = await fetchWithTimeout("https://example.test", {}, 20).catch((e: unknown) => e);
    expect(isTimeoutError(error)).toBe(true);
    expect(describeFetchError(error, 60_000)).toBe("keine Antwort innerhalb von 60 Sekunden");
  });

  it("passes the response through when the upstream answers in time", async () => {
    vi.stubGlobal("fetch", async () => new Response("ok"));
    const res = await fetchWithTimeout("https://example.test");
    expect(await res.text()).toBe("ok");
  });

  it("describes ordinary errors by their message", () => {
    expect(describeFetchError(new Error("ECONNREFUSED"))).toBe("ECONNREFUSED");
  });
});
