import { describe, expect, it } from "vitest";
import { weekStartUtc } from "./cardioLog.service.js";

describe("weekStartUtc", () => {
  it("returns Monday 00:00 UTC for a midweek date", () => {
    // Thursday 2026-10-08
    expect(weekStartUtc(new Date("2026-10-08T15:30:00Z")).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("treats Sunday as the last day of the week", () => {
    expect(weekStartUtc(new Date("2026-10-11T23:59:00Z")).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("returns the same day for a Monday", () => {
    expect(weekStartUtc(new Date("2026-10-05T00:00:00Z")).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
});
