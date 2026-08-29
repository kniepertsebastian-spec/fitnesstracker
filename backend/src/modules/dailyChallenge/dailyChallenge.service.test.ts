import { describe, expect, it } from "vitest";
import { computeTargetReps, type RecentPerformance } from "./dailyChallenge.service.js";

describe("computeTargetReps", () => {
  const perf: RecentPerformance = { avgReps: 10, maxReps: 15 };

  it("PROGRESSION targets one rep past the all-time best set", () => {
    expect(computeTargetReps("PROGRESSION", perf, null)).toBe(17);
  });

  it("PROGRESSION falls back to the baseline + 2 with no history", () => {
    expect(computeTargetReps("PROGRESSION", null, 8)).toBe(10);
  });

  it("VOLUME roughly doubles the usual output, floored at 10", () => {
    expect(computeTargetReps("VOLUME", perf, null)).toBe(20);
    expect(computeTargetReps("VOLUME", { avgReps: 3, maxReps: 5 }, null)).toBe(10);
  });

  it("TECHNIQUE stays at or under the usual set size, floored at 6", () => {
    expect(computeTargetReps("TECHNIQUE", perf, null)).toBe(10);
    expect(computeTargetReps("TECHNIQUE", null, 20)).toBe(12);
    expect(computeTargetReps("TECHNIQUE", null, 4)).toBe(6);
  });

  it("RECOVERY is always a small fixed target, regardless of history", () => {
    expect(computeTargetReps("RECOVERY", perf, 30)).toBe(10);
    expect(computeTargetReps("RECOVERY", null, null)).toBe(10);
  });

  it("CONSISTENCY matches the usual baseline, floored at 6", () => {
    expect(computeTargetReps("CONSISTENCY", perf, null)).toBe(10);
    expect(computeTargetReps("CONSISTENCY", null, null)).toBe(10);
  });
});
