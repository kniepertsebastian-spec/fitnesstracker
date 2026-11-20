import { describe, expect, it } from "vitest";
import { pickDayRotation, type RotationDay, type RotationLog } from "./dayRotation.js";

const day = (dayLabel: string | null, exerciseIds: string[], completed = false): RotationDay => ({
  dayLabel,
  exerciseIds,
  completed,
});
const at = (exerciseId: string, iso: string): RotationLog => ({ exerciseId, performedAt: new Date(iso) });

const push = (completed = false) => day("Push", ["p1", "p2"], completed);
const pull = (completed = false) => day("Pull", ["u1", "u2"], completed);
const legs = (completed = false) => day("Legs", ["l1", "l2"], completed);

describe("pickDayRotation", () => {
  it("starts with the first day when nothing was trained yet", () => {
    expect(pickDayRotation([push(), pull(), legs()], [])).toEqual({ activeDayIndex: 0, nextDayIndex: 0 });
  });

  it("suggests the day after the one trained last", () => {
    const logs = [at("u1", "2026-11-17T10:00:00Z"), at("u2", "2026-11-17T10:20:00Z")];
    expect(pickDayRotation([push(), pull(), legs()], logs).activeDayIndex).toBe(2);
  });

  it("does not get stuck on day 1 when one of its exercises was never trained", () => {
    // Push was trained (p1 only, p2 skipped) and Pull as well -> Legs is due, not Push.
    const days = [push(false), pull(true), legs(false)];
    const logs = [at("u1", "2026-11-18T10:00:00Z"), at("u2", "2026-11-18T10:30:00Z"), at("p1", "2026-11-17T10:00:00Z")];
    expect(pickDayRotation(days, logs).activeDayIndex).toBe(2);
  });

  it("wraps around to the first day after the last one", () => {
    const logs = [at("l1", "2026-11-19T10:00:00Z"), at("l2", "2026-11-19T10:30:00Z")];
    expect(pickDayRotation([push(), pull(), legs(true)], logs).activeDayIndex).toBe(0);
  });

  it("skips days that are already finished this week", () => {
    const logs = [at("l1", "2026-11-19T10:00:00Z")];
    expect(pickDayRotation([push(true), pull(false), legs(false)], logs).activeDayIndex).toBe(1);
  });

  it("has no active day once everything is finished, but still names the next one in the cycle", () => {
    const logs = [at("u1", "2026-11-19T10:00:00Z"), at("u2", "2026-11-19T10:30:00Z")];
    expect(pickDayRotation([push(true), pull(true), legs(true)], logs)).toEqual({ activeDayIndex: null, nextDayIndex: 2 });
  });

  it("ignores an unlabelled leftover group next to named days", () => {
    const days = [push(), pull(), legs(), day(null, ["p1", "p2", "u1", "u2", "l1", "l2"])];
    const logs = [at("l1", "2026-11-19T10:00:00Z")];
    expect(pickDayRotation(days, logs).activeDayIndex).toBe(0);
  });

  it("uses the unlabelled group when it is the only one", () => {
    expect(pickDayRotation([day(null, ["a"])], [])).toEqual({ activeDayIndex: 0, nextDayIndex: 0 });
  });

  it("resolves an exercise shared by two days by what else was trained in that workout", () => {
    const days = [day("A", ["squat", "a1"]), day("B", ["squat", "b1"]), day("C", ["c1"])];
    const logs = [at("squat", "2026-11-19T10:00:00Z"), at("b1", "2026-11-19T10:10:00Z")];
    expect(pickDayRotation(days, logs).activeDayIndex).toBe(2);
  });

  it("only counts sets of the latest workout, not of one days ago", () => {
    const logs = [at("p1", "2026-11-10T10:00:00Z"), at("p2", "2026-11-10T10:10:00Z"), at("u1", "2026-11-12T10:00:00Z")];
    expect(pickDayRotation([push(), pull(), legs()], logs).activeDayIndex).toBe(2);
  });
});
