import { describe, expect, it } from "vitest";
import { formatTick, formatValue, niceTicks, timeTicks } from "./chartScale";

describe("niceTicks", () => {
  it("rounds the axis to clean numbers that contain the data", () => {
    const { ticks, lo, hi } = niceTicks(62, 118, 5);
    expect(ticks).toEqual([60, 80, 100, 120]);
    expect(lo).toBe(60);
    expect(hi).toBe(120);
  });

  it("handles small ranges and a flat series", () => {
    expect(niceTicks(7.4, 8.9, 4).ticks).toEqual([7, 7.5, 8, 8.5, 9]);
    const flat = niceTicks(50, 50);
    expect(flat.lo).toBeLessThan(50);
    expect(flat.hi).toBeGreaterThan(50);
  });
});

describe("timeTicks", () => {
  const day = 86_400_000;
  it("uses month starts for a long span", () => {
    const t0 = Date.UTC(2026, 0, 10);
    const ticks = timeTicks(t0, Date.UTC(2026, 6, 20));
    expect(ticks.length).toBeLessThanOrEqual(6);
    expect(ticks.every((t) => new Date(t).getUTCDate() === 1)).toBe(true);
    expect(ticks[0]).toBeGreaterThanOrEqual(t0);
  });

  it("uses days for a short span and never too many", () => {
    const t0 = Date.UTC(2026, 8, 1);
    const ticks = timeTicks(t0, t0 + 28 * day);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.length).toBeLessThanOrEqual(6);
  });
});

describe("formatting", () => {
  it("labels ticks by span and formats values", () => {
    expect(formatTick(Date.UTC(2026, 8, 7), 20 * 86_400_000)).toBe("7. Sep");
    expect(formatTick(Date.UTC(2027, 0, 1), 200 * 86_400_000)).toBe("Jan 27");
    expect(formatValue(62.54, "kg")).toBe("62,5 kg");
    expect(formatValue(9.6, "Wdh.")).toBe("10 Wdh.");
  });
});
