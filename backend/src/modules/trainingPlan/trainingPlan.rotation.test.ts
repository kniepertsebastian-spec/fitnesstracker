import { describe, expect, it } from "vitest";
import { computeRotation } from "./trainingPlan.service.js";

const start = new Date("2026-01-05T00:00:00Z"); // a Monday

function plan(extensionWeeks = 0) {
  return { currentPhase: "AUFBAU" as const, phaseStartedOn: start, extensionWeeks };
}
const weeksAfter = (w: number, extraDays = 0) => new Date(start.getTime() + (w * 7 + extraDays) * 86400000);

describe("computeRotation", () => {
  it("rotates after 8 weeks without extension", () => {
    const r = computeRotation(plan(), weeksAfter(8));
    expect(r.currentPhase).toBe("MUSKELAUSDAUER");
    expect(r.closedHistory).toHaveLength(1);
    expect(r.phaseStartedOn.toISOString()).toBe(weeksAfter(8).toISOString());
  });

  it("+1 Woche moves the phase change out by exactly one week", () => {
    const without = computeRotation(plan(0), weeksAfter(7));
    const withExt = computeRotation(plan(1), weeksAfter(7));
    expect(withExt.nextRotationOn.getTime() - without.nextRotationOn.getTime()).toBe(7 * 86400000);
  });

  it("does not rotate during the extension week, but does right after", () => {
    const during = computeRotation(plan(1), weeksAfter(8, 3));
    expect(during.currentPhase).toBe("AUFBAU");
    expect(during.closedHistory).toHaveLength(0);
    expect(during.nextRotationOn.toISOString()).toBe(weeksAfter(9).toISOString());

    const after = computeRotation(plan(1), weeksAfter(9));
    expect(after.currentPhase).toBe("MUSKELAUSDAUER");
    expect(after.closedHistory[0].endedOn?.toISOString()).toBe(weeksAfter(9).toISOString());
    // The next phase is a plain 8 weeks — the extension doesn't carry over.
    expect(after.nextRotationOn.toISOString()).toBe(weeksAfter(17).toISOString());
  });

  it("catches up through several overdue cycles", () => {
    const r = computeRotation(plan(2), weeksAfter(10 + 8 + 1));
    expect(r.closedHistory.map((h) => h.phase)).toEqual(["AUFBAU", "MUSKELAUSDAUER"]);
    expect(r.currentPhase).toBe("NEGATIV");
  });
});
