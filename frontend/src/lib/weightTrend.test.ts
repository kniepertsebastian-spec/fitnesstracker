import { describe, expect, it } from "vitest";
import { weightTrendAt } from "./weightTrend";

const p = (measuredAt: string, weightKg: number) => ({ measuredAt, weightKg });

describe("weightTrendAt", () => {
  it("averages the seven days up to the given moment", () => {
    const points = [p("2026-11-01T07:00:00Z", 83), p("2026-11-03T07:00:00Z", 82), p("2026-11-05T07:00:00Z", 81), p("2026-11-07T07:00:00Z", 80)];
    expect(weightTrendAt(points, "2026-11-07T07:00:00Z")).toBeCloseTo(81.5, 5);
  });
  it("ignores readings older than seven days and later ones", () => {
    const points = [p("2026-10-20T07:00:00Z", 90), p("2026-11-05T07:00:00Z", 81), p("2026-11-10T07:00:00Z", 70)];
    expect(weightTrendAt(points, "2026-11-07T07:00:00Z")).toBe(81);
  });
  it("counts a day once however many readings it has", () => {
    const points = [p("2026-11-06T07:00:00Z", 80), p("2026-11-06T07:05:00Z", 80), p("2026-11-06T07:10:00Z", 80), p("2026-11-07T07:00:00Z", 82)];
    expect(weightTrendAt(points, "2026-11-07T08:00:00Z")).toBe(81);
  });
  it("returns null without readings in the window", () => {
    expect(weightTrendAt([], "2026-11-07T07:00:00Z")).toBeNull();
    expect(weightTrendAt([p("2026-10-01T07:00:00Z", 80)], "2026-11-07T07:00:00Z")).toBeNull();
  });
});
