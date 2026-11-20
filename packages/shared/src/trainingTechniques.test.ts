import { describe, expect, it } from "vitest";
import {
  GROUP_SIZE,
  PERIODIZATIONS,
  SET_SCHEME_INFO,
  TECHNIQUES,
  TECHNIQUE_INFO,
  buildSetPlan,
  maxTechniquesPerDay,
  shiftPrescription,
  techniqueAllowedFor,
  weekShift,
} from "./trainingTechniques.js";

describe("technique catalog", () => {
  it("has an info text for every technique and all fields filled", () => {
    for (const t of TECHNIQUES) {
      const info = TECHNIQUE_INFO[t];
      expect(info.label.length, `${t}.label`).toBeGreaterThan(3);
      for (const field of ["short", "what", "how", "goodFor", "avoid", "note"] as const) {
        expect(info[field].length, `${t}.${field}`).toBeGreaterThan(10);
      }
    }
    expect(TECHNIQUES).toHaveLength(13);
  });

  it("group techniques have a size, the others do not", () => {
    for (const t of TECHNIQUES) {
      expect(Boolean(GROUP_SIZE[t])).toBe(TECHNIQUE_INFO[t].kind === "group");
    }
  });

  it("offers advanced techniques only to advanced users and keeps beginners at one per day", () => {
    expect(techniqueAllowedFor("MYO_REPS", "intermediate")).toBe(false);
    expect(techniqueAllowedFor("MYO_REPS", "advanced")).toBe(true);
    expect(techniqueAllowedFor("SUPERSET", "beginner")).toBe(true);
    expect(maxTechniquesPerDay(6, "beginner")).toBe(1);
    expect(maxTechniquesPerDay(6, "intermediate")).toBe(2);
    expect(maxTechniquesPerDay(9, "advanced")).toBe(3);
    expect(maxTechniquesPerDay(3, "advanced")).toBe(1);
  });

  it("describes the two in-session schemes and the two periodizations", () => {
    expect(Object.keys(SET_SCHEME_INFO)).toEqual(["PYRAMID", "TIME_BASED"]);
    expect(PERIODIZATIONS).toEqual(["LINEAR", "WAVE"]);
  });
});

describe("buildSetPlan", () => {
  it("returns nothing for straight sets", () => {
    expect(buildSetPlan("STRAIGHT", 3, 8, 12)).toBeNull();
    expect(buildSetPlan(null, 3, 8, 12)).toBeNull();
  });

  it("builds a pyramid: reps fall from the top to the bottom of the range, weight rises", () => {
    const plan = buildSetPlan("PYRAMID", 4, 6, 12)!;
    expect(plan.map((s) => s.reps)).toEqual([12, 10, 8, 6]);
    expect(plan[0].weightPct).toBe(75);
    expect(plan[3].weightPct).toBe(100);
    expect(plan.map((s) => s.weightPct)).toEqual([...plan.map((s) => s.weightPct)].sort((a, b) => (a ?? 0) - (b ?? 0)));
  });

  it("handles a pyramid with one or two sets", () => {
    expect(buildSetPlan("PYRAMID", 1, 6, 12)).toEqual([{ reps: 12, weightPct: 75 }]);
    expect(buildSetPlan("PYRAMID", 2, 6, 12)!.map((s) => s.reps)).toEqual([12, 6]);
  });

  it("builds timed sets with a sensible hold time", () => {
    const plan = buildSetPlan("TIME_BASED", 3, 8, 12)!;
    expect(plan).toHaveLength(3);
    expect(plan.every((s) => s.seconds! >= 20 && s.seconds! <= 600 && s.reps === undefined)).toBe(true);
  });
});

describe("weekShift", () => {
  it("linear: easier weeks first, heavier at the end", () => {
    expect(weekShift("LINEAR", 1, 8)).toMatchObject({ repsDelta: 2, rirDelta: 1 });
    expect(weekShift("LINEAR", 8, 8)).toMatchObject({ repsDelta: -2, rirDelta: -1 });
    const mid = weekShift("LINEAR", 4, 8);
    expect(mid.repsDelta).toBeLessThan(2);
    expect(mid.repsDelta).toBeGreaterThan(-2);
  });

  it("wave: medium, heavy, light, then again", () => {
    expect(weekShift("WAVE", 1, 8).label).toBe("mittlere Woche");
    expect(weekShift("WAVE", 2, 8)).toMatchObject({ repsDelta: -2, rirDelta: -1 });
    expect(weekShift("WAVE", 3, 8)).toMatchObject({ repsDelta: 3, rirDelta: 1 });
    expect(weekShift("WAVE", 4, 8).label).toBe("mittlere Woche");
  });

  it("copes with a one-week phase", () => {
    expect(weekShift("LINEAR", 1, 1).repsDelta).toBe(2);
  });
});

describe("shiftPrescription", () => {
  const base = { repRangeMin: 8, repRangeMax: 12, targetReps: 12, targetRir: 2, setPlan: [{ reps: 12, weightPct: 75 }, { seconds: 40 }] };

  it("moves reps and RIR by the week's shift and leaves timed sets alone", () => {
    const shifted = shiftPrescription(base, { repsDelta: -2, rirDelta: -1, label: "schwere Woche" });
    expect(shifted).toMatchObject({ repRangeMin: 6, repRangeMax: 10, targetReps: 10, targetRir: 1 });
    expect(shifted.setPlan).toEqual([{ reps: 10, weightPct: 75 }, { seconds: 40 }]);
  });

  it("keeps fields that are empty empty, and stays within the limits", () => {
    const manual = { repRangeMin: null, repRangeMax: null, targetReps: 2, targetRir: 0, setPlan: null };
    expect(shiftPrescription(manual, { repsDelta: -3, rirDelta: -1, label: "x" })).toEqual({ repRangeMin: null, repRangeMax: null, targetReps: 1, targetRir: 0, setPlan: null });
    expect(shiftPrescription({ ...manual, targetRir: 5 }, { repsDelta: 0, rirDelta: 1, label: "x" }).targetRir).toBe(5);
  });
});
