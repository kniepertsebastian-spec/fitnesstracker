import { describe, expect, it } from "vitest";
import { buildSeries, exercisesInRange, phaseBands, type SetLike } from "./progressSeries";

const set = (day: string, reps: number, weightKg: number, extra: Partial<SetLike> = {}): SetLike => ({
  exerciseId: "bench",
  reps,
  weightKg,
  performedAt: `${day}T10:00:00.000Z`,
  ...extra,
});

const logs: SetLike[] = [
  set("2026-09-01", 8, 60),
  set("2026-09-01", 6, 65),
  set("2026-09-08", 8, 62.5),
  set("2026-09-15", 5, 70), // new best weight
  set("2026-09-22", 10, 55),
  set("2026-09-22", 12, 50, { exerciseId: "other" }),
];

describe("buildSeries", () => {
  it("has one point per training day, oldest first", () => {
    const s = buildSeries(logs, "bench", "weight");
    expect(s.map((p) => p.dayKey)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"]);
    expect(s.map((p) => p.value)).toEqual([65, 62.5, 70, 55]);
    expect(s[0].sets).toBe(2);
  });

  it("measures the best estimated 1RM of the day", () => {
    const s = buildSeries(logs, "bench", "e1rm");
    // Day 1: the better of 60×8 and 65×6 — the 6 reps at 65 kg is the stronger estimate.
    expect(s[0].value).toBeGreaterThan(75);
    expect(s[2].value).toBeGreaterThan(s[1].value);
  });

  it("sums the volume and finds the best reps", () => {
    expect(buildSeries(logs, "bench", "volume")[0].value).toBe(60 * 8 + 65 * 6);
    expect(buildSeries(logs, "bench", "reps").map((p) => p.value)).toEqual([8, 8, 5, 10]);
  });

  it("marks the days that beat everything before them", () => {
    const s = buildSeries(logs, "bench", "weight");
    expect(s.map((p) => p.record)).toEqual([true, false, true, false]);
  });

  it("decides records on the whole history, not on the visible range", () => {
    // From 22 Sep on only one day is visible; it is not a record just because the range starts there.
    const s = buildSeries(logs, "bench", "weight", new Date("2026-09-20T00:00:00Z"));
    expect(s).toHaveLength(1);
    expect(s[0].record).toBe(false);
  });

  it("leaves partial reps, 21s and timed sets out of the records, but not out of the volume", () => {
    const withPartial = [...logs, set("2026-09-29", 5, 120, { technique: "PARTIAL_REPS" }), set("2026-09-29", 5, 60)];
    const best = buildSeries(withPartial, "bench", "weight").at(-1)!;
    expect(best.value).toBe(60);
    expect(buildSeries(withPartial, "bench", "volume").at(-1)!.value).toBe(120 * 5 + 60 * 5);
    const timed = [set("2026-10-06", 1, 0, { durationSeconds: 45 })];
    expect(buildSeries(timed, "bench", "weight")).toEqual([]);
    expect(buildSeries(timed, "bench", "volume")).toEqual([]);
  });

  it("skips days without a value for the measure (bodyweight sets have no 1RM)", () => {
    expect(buildSeries([set("2026-09-01", 12, 0)], "bench", "e1rm")).toEqual([]);
    expect(buildSeries([set("2026-09-01", 12, 0)], "bench", "reps")).toHaveLength(1);
  });
});

describe("exercisesInRange", () => {
  it("lists the exercises of the range, the most recently trained first", () => {
    const named = [
      { ...set("2026-09-01", 8, 60), exerciseName: "Bankdrücken" },
      { ...set("2026-09-22", 12, 50, { exerciseId: "other" }), exerciseName: "Rudern" },
      { ...set("2026-09-08", 8, 60), exerciseName: "Bankdrücken" },
    ];
    expect(exercisesInRange(named, null).map((e) => [e.exerciseName, e.days])).toEqual([["Rudern", 1], ["Bankdrücken", 2]]);
    expect(exercisesInRange(named, new Date("2026-09-10T00:00:00Z")).map((e) => e.exerciseName)).toEqual(["Rudern"]);
  });
});

describe("phaseBands", () => {
  const label = (p: string) => p.toLowerCase();
  const window = { from: Date.parse("2026-08-01"), to: Date.parse("2026-11-01") };

  it("lays the finished phases and the current one end to end, cut to the window", () => {
    const bands = phaseBands(
      [
        { phase: "AUFBAU", startedOn: "2026-06-01", endedOn: "2026-09-01" },
        { phase: "DELOAD", startedOn: "2026-09-01", endedOn: "2026-09-08" },
      ],
      { phase: "KRAFT", startedOn: "2026-09-08" },
      label,
      window,
    );
    expect(bands.map((b) => b.label)).toEqual(["aufbau", "deload", "kraft"]);
    expect(bands[0].from).toBe(window.from); // started before the window
    expect(bands[2].to).toBe(window.to);
  });

  it("drops phases outside the window and joins the same phase twice in a row", () => {
    const bands = phaseBands(
      [
        { phase: "A", startedOn: "2026-01-01", endedOn: "2026-03-01" },
        { phase: "B", startedOn: "2026-08-01", endedOn: "2026-09-01" },
        { phase: "B", startedOn: "2026-09-01", endedOn: "2026-10-01" },
      ],
      { phase: "C", startedOn: "2026-10-01" },
      label,
      window,
    );
    expect(bands.map((b) => b.label)).toEqual(["b", "c"]);
  });
});
