import { describe, expect, it } from "vitest";
import { addDayKeys, bodyTrend, type BodyMeasurement } from "./bodyTrend.js";

const m = (iso: string, weightKg: number, bodyWaterPercent: number | null = null): BodyMeasurement => ({ measuredAt: new Date(iso), weightKg, bodyWaterPercent, bodyFatPercent: null });

describe("body trend for the progress view", () => {
  it("keeps the last measurement of each local day, oldest first", () => {
    const t = bodyTrend([m("2026-11-24T06:00:00Z", 90.4), m("2026-11-24T19:00:00Z", 91.2), m("2026-11-23T06:00:00Z", 90.8)], "Europe/Berlin", "2026-11-25", 30);
    expect(t.points.map((p) => [p.date, p.weightKg])).toEqual([
      ["2026-11-23", 90.8],
      ["2026-11-24", 91.2],
    ]);
    expect(t.latest?.weightKg).toBe(91.2);
  });

  it("assigns a measurement to the user's local day, not the UTC day", () => {
    // 23:30 UTC on the 24th is already the 25th in Berlin.
    const t = bodyTrend([m("2026-11-24T23:30:00Z", 90)], "Europe/Berlin", "2026-11-25", 7);
    expect(t.points[0]!.date).toBe("2026-11-25");
  });

  it("compares the 7-day mean with the week before, only when both weeks have data", () => {
    const list = [
      m("2026-11-12T06:00:00Z", 92),
      m("2026-11-14T06:00:00Z", 91),
      m("2026-11-20T06:00:00Z", 90.5),
      m("2026-11-25T06:00:00Z", 89.5),
    ];
    const t = bodyTrend(list, "UTC", "2026-11-25", 30);
    expect(t.avg7Kg).toBe(90);
    expect(t.avgPrev7Kg).toBe(91.5);
    expect(t.weeklyChangeKg).toBe(-1.5);
    expect(bodyTrend(list.slice(2), "UTC", "2026-11-25", 30).weeklyChangeKg).toBeNull();
  });

  it("gives the water context from the last two days with a water value, and invents none", () => {
    const t = bodyTrend([m("2026-11-22T06:00:00Z", 90, 55.1), m("2026-11-23T06:00:00Z", 90.2), m("2026-11-24T06:00:00Z", 91.1, 56.3)], "UTC", "2026-11-25", 7);
    expect(t.water).toEqual({ date: "2026-11-24", previousDate: "2026-11-22", weightChangeKg: 1.1, waterChangePercentPoints: 1.2 });
    expect(t.points[1]!.bodyWaterPercent).toBeNull();
    expect(bodyTrend([m("2026-11-24T06:00:00Z", 91, 56)], "UTC", "2026-11-25", 7).water).toBeNull();
  });

  it("limits the points to the requested days and ignores future measurements", () => {
    const t = bodyTrend([m("2026-10-01T06:00:00Z", 95), m("2026-11-20T06:00:00Z", 90), m("2026-11-27T06:00:00Z", 89)], "UTC", "2026-11-25", 30);
    expect(t.points.map((p) => p.date)).toEqual(["2026-11-20"]);
    expect(bodyTrend([], "UTC", "2026-11-25", 7)).toMatchObject({ points: [], latest: null, avg7Kg: null, water: null });
  });

  it("adds days across month ends", () => {
    expect(addDayKeys("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDayKeys("2026-03-01", -1)).toBe("2026-02-28");
  });
});
