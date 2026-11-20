import { describe, expect, it } from "vitest";
import { weekPeriodization } from "./planWeekStatus.service.js";

const start = new Date("2026-11-02T00:00:00Z"); // a Monday
const day = 86_400_000;
const plan = (over: Partial<{ currentPhase: "AUFBAU" | "NEGATIV"; extensionWeeks: number; pausedAt: Date | null }> = {}) => ({
  currentPhase: "AUFBAU" as const,
  phaseStartedOn: start,
  extensionWeeks: 0,
  pausedAt: null,
  ...over,
});
const configs = [
  { phase: "AUFBAU" as const, label: "Aufbau", isDaily: false, weeks: 6, periodization: "WAVE" as const },
  { phase: "NEGATIV" as const, label: "Negativ", isDaily: false },
];

describe("weekPeriodization", () => {
  it("counts the weeks of the current phase from its start", () => {
    expect(weekPeriodization(plan(), configs, "AUFBAU", new Date(start.getTime() + 1 * day))).toEqual({ kind: "WAVE", week: 1, totalWeeks: 6 });
    expect(weekPeriodization(plan(), configs, "AUFBAU", new Date(start.getTime() + 15 * day))).toMatchObject({ week: 3 });
  });

  it("caps at the phase length, including an extension", () => {
    expect(weekPeriodization(plan(), configs, "AUFBAU", new Date(start.getTime() + 100 * day))).toMatchObject({ week: 6 });
    expect(weekPeriodization(plan({ extensionWeeks: 2 }), configs, "AUFBAU", new Date(start.getTime() + 100 * day))).toMatchObject({ week: 8, totalWeeks: 8 });
  });

  it("stands still while the phase is paused", () => {
    const paused = plan({ pausedAt: new Date(start.getTime() + 8 * day) });
    expect(weekPeriodization(paused, configs, "AUFBAU", new Date(start.getTime() + 60 * day))).toMatchObject({ week: 2 });
  });

  it("is none for a phase without a pattern or one that is not the current phase", () => {
    expect(weekPeriodization(plan({ currentPhase: "NEGATIV" }), configs, "NEGATIV", start)).toBeNull();
    expect(weekPeriodization(plan(), configs, "NEGATIV", start)).toBeNull();
    expect(weekPeriodization(plan({ currentPhase: "NEGATIV" }), configs, "AUFBAU", start)).toBeNull();
    expect(weekPeriodization(null, configs, "AUFBAU", start)).toBeNull();
  });
});
