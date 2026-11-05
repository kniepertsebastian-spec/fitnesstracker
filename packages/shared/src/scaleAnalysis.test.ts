import { describe, expect, it } from "vitest";
import { analyzeScaleReadings, groupSessions, type ScaleReading } from "./scaleAnalysis.js";

const r1 = (v: number) => Math.round(v * 10) / 10;

// A synthetic Fitdays-like reading: everything follows from weight and fat mass the way the real
// reports do (fixed shares of the fat-free mass), plus raw impedances.
function reading(measuredAt: string, weightKg: number, fatMassKg: number, legImpedance: number, extra: { visceral?: number } = {}): ScaleReading {
  const ffm = r1(weightKg - fatMassKg);
  const bone = r1(0.0667 * ffm);
  const protein = r1(0.2 * ffm);
  const water = r1(0.7333 * ffm);
  const skeletal = r1(0.5824 * ffm);
  const bodyFat = r1((fatMassKg / weightKg) * 100);
  const set = (leg: number) => ({ rightArm: 260, leftArm: 255, trunk: 25, rightLeg: leg, leftLeg: leg - 20 });
  return {
    measuredAt,
    weightKg,
    bodyFatPercent: bodyFat,
    muscleMassKg: r1(ffm - bone),
    bodyWaterPercent: r1((water / weightKg) * 100),
    details: {
      source: "fitdays-report",
      fatMassKg,
      fatFreeMassKg: ffm,
      boneMassKg: bone,
      proteinKg: protein,
      waterKg: water,
      skeletalMuscleKg: skeletal,
      subcutaneousFatPercent: r1(0.714 * bodyFat),
      visceralFat: extra.visceral ?? 9,
      basalMetabolicRateKcal: Math.round(370 + 21.6 * ffm),
      asmi: Math.round(0.2268 * skeletal * 100) / 100,
      impedance: { khz20: set(legImpedance), khz100: set(legImpedance - 30) },
    },
  };
}

// Three weigh-ins on one morning (two of them minutes apart) and several on other days.
const readings: ScaleReading[] = [
  reading("2026-10-01T05:40:00Z", 100.4, 20.0, 150, { visceral: 8 }),
  reading("2026-10-08T05:30:00Z", 99.8, 24.0, 158, { visceral: 11 }),
  reading("2026-10-15T05:35:00Z", 99.5, 26.5, 163, { visceral: 12 }),
  reading("2026-10-22T05:20:00Z", 100.1, 22.0, 153, { visceral: 9 }),
  reading("2026-11-05T05:17:00Z", 99.2, 23.0, 156, { visceral: 10 }),
  reading("2026-11-05T05:26:00Z", 99.2, 28.0, 168, { visceral: 13 }),
];

describe("groupSessions", () => {
  it("puts weigh-ins within an hour into one session and splits the rest", () => {
    const sessions = groupSessions(readings);
    expect(sessions.map((s) => s.length)).toEqual([1, 1, 1, 1, 2]);
    expect(groupSessions([...readings].reverse()).map((s) => s.length)).toEqual([1, 1, 1, 1, 2]);
  });
});

describe("analyzeScaleReadings", () => {
  const analysis = analyzeScaleReadings(readings);
  const noise = (key: string) => analysis.noise.find((n) => n.key === key);
  const derived = (key: string) => analysis.derived.find((d) => d.key === key);

  it("counts readings, sessions and the data behind them", () => {
    expect(analysis).toMatchObject({ readings: 6, withDetails: 6, withImpedance: 6, repeatSessions: 1 });
    expect(analysis.sessions).toHaveLength(5);
  });

  it("measures noise from repeats inside a session: pooled standard deviation and range", () => {
    // Two readings 5.0 kg of fat apart: |difference| / sqrt(2).
    expect(noise("fatMassKg")).toMatchObject({ sd: 3.54, maxRange: 5, repeats: 1 });
    expect(noise("weightKg")).toMatchObject({ sd: 0, maxRange: 0 });
    expect(noise("khz20.rightLeg")).toMatchObject({ sd: 8.49, maxRange: 12 });
    // Between-session spread needs at least three sessions.
    expect(noise("fatMassKg")?.betweenSd).not.toBeNull();
  });

  it("reports no noise at all when nothing was measured twice in a row", () => {
    expect(analyzeScaleReadings(readings.slice(0, 5)).noise).toEqual([]);
  });

  it("finds values that are exact sums or differences of others", () => {
    expect(derived("fatFreeMassKg")).toMatchObject({ relation: "identity", basis: "Gewicht − Fettmasse" });
    expect(derived("bodyFatPercent")).toMatchObject({ relation: "identity" });
    expect(derived("muscleMassKg")).toMatchObject({ relation: "identity", basis: "fettfreie Masse − Knochenmasse" });
    expect(derived("waterKg")).toMatchObject({ relation: "identity" });
  });

  it("finds values that are a fixed share of another one", () => {
    expect(derived("proteinKg")).toMatchObject({ relation: "ratio", basis: "Fettfreie Masse" });
    expect(derived("proteinKg")?.ratio).toBeCloseTo(0.2, 2);
    expect(derived("boneMassKg")?.ratio).toBeCloseTo(0.0667, 3);
    expect(derived("skeletalMuscleKg")?.relation).toBe("ratio");
    expect(derived("subcutaneousFatPercent")).toMatchObject({ relation: "ratio", basis: "Körperfett" });
  });

  it("recognises a linear relation with an offset once there are enough readings (BMR from fat-free mass)", () => {
    const bmr = derived("basalMetabolicRateKcal");
    expect(bmr).toMatchObject({ relation: "linear", basis: "Fettfreie Masse" });
    expect(bmr?.slope).toBeCloseTo(21.6, 0);
    expect(bmr?.intercept).toBeGreaterThan(300);
    expect(bmr?.intercept).toBeLessThan(440);
  });

  it("leaves values without a found derivation as independent", () => {
    const keys = analysis.independent.map((i) => i.key);
    expect(keys).toContain("weightKg");
    expect(keys).toContain("fatMassKg");
    expect(keys).toContain("visceralFat");
    expect(keys).not.toContain("waterKg");
    expect(keys).not.toContain("muscleMassKg");
  });

  it("names the impedance channels that move with body fat, once there are six readings", () => {
    expect(analysis.driversNeeded).toBe(0);
    expect(analysis.drivers[0].channelKey).toMatch(/Leg/);
    expect(analysis.drivers[0].r).toBeGreaterThan(0.95);
    const few = analyzeScaleReadings(readings.slice(0, 4));
    expect(few.drivers).toEqual([]);
    expect(few.driversNeeded).toBe(2);
  });

  it("works with plain measurements that have no report details", () => {
    const plain: ScaleReading[] = [
      { measuredAt: "2026-11-05T05:17:00Z", weightKg: 119.1, bodyFatPercent: 22.4, muscleMassKg: 86.3, bodyWaterPercent: 56.9, details: null },
      { measuredAt: "2026-11-05T05:26:00Z", weightKg: 119.1, bodyFatPercent: 25.5, muscleMassKg: 82.7, bodyWaterPercent: 54.6, details: null },
    ];
    const result = analyzeScaleReadings(plain);
    expect(result.withDetails).toBe(0);
    expect(result.noise.find((n) => n.key === "bodyFatPercent")?.sd).toBeCloseTo(2.19, 2);
    expect(result.noise.find((n) => n.key === "muscleMassKg")?.sd).toBeCloseTo(2.55, 2);
  });
});
