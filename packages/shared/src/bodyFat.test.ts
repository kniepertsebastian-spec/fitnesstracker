import { describe, expect, it } from "vitest";
import { applyCalibrationOffset } from "./schemas/bodyFatCalibration.schema.js";
import {
  bodyFatRange,
  estimateBodyFatCunBae,
  estimateBodyFatNavy,
  estimateBodyFatRfm,
  fatFreeMassIndex,
  waistToHeightRatio,
} from "./bodyFat.js";

describe("estimateBodyFatCunBae", () => {
  it("matches the published equation for a tall, heavy man (BMI 35.1, 29 y)", () => {
    expect(estimateBodyFatCunBae({ weightKg: 120.3, heightCm: 185, age: 29, gender: "MALE" })).toBe(36.1);
  });

  it("gives typical values for an average adult of each sex (BMI 25, 40 y)", () => {
    const weightKg = 25 * 1.7 ** 2;
    expect(estimateBodyFatCunBae({ weightKg, heightCm: 170, age: 40, gender: "MALE" })).toBe(23.4);
    expect(estimateBodyFatCunBae({ weightKg, heightCm: 170, age: 40, gender: "FEMALE" })).toBe(35.5);
  });

  it("returns null instead of NaN for missing or impossible inputs", () => {
    expect(estimateBodyFatCunBae({ weightKg: 0, heightCm: 180, age: 30, gender: "MALE" })).toBeNull();
    expect(estimateBodyFatCunBae({ weightKg: 80, heightCm: Number.NaN, age: 30, gender: "MALE" })).toBeNull();
  });

  it("stays within 0-100 %", () => {
    const value = estimateBodyFatCunBae({ weightKg: 40, heightCm: 190, age: 18, gender: "MALE" });
    expect(value).not.toBeNull();
    expect(value!).toBeGreaterThanOrEqual(0);
    expect(value!).toBeLessThanOrEqual(100);
  });
});

describe("fatFreeMassIndex", () => {
  it("derives fat-free mass per m² from weight and body fat", () => {
    // 120.3 kg at 20.4 % -> 95.8 kg fat-free at 1.85 m
    expect(fatFreeMassIndex(120.3, 20.4, 185)).toBe(28);
  });

  it("returns null for unusable inputs", () => {
    expect(fatFreeMassIndex(80, 100, 180)).toBeNull();
    expect(fatFreeMassIndex(80, -1, 180)).toBeNull();
    expect(fatFreeMassIndex(80, 20, 0)).toBeNull();
  });
});

// Reference values recalculated independently from the published equations.
describe("estimateBodyFatRfm", () => {
  it("men: 182 cm, waist 88 -> 22.6 %", () => {
    expect(estimateBodyFatRfm({ heightCm: 182, waistCm: 88, gender: "MALE" })).toBe(22.6);
  });
  it("women use the constant 76: 165 cm, waist 82 -> 35.8 %", () => {
    expect(estimateBodyFatRfm({ heightCm: 165, waistCm: 82, gender: "FEMALE" })).toBe(35.8);
  });
  it("returns null for missing or impossible inputs and clamps at 0", () => {
    expect(estimateBodyFatRfm({ heightCm: 0, waistCm: 88, gender: "MALE" })).toBeNull();
    expect(estimateBodyFatRfm({ heightCm: 180, waistCm: Number.NaN, gender: "MALE" })).toBeNull();
    expect(estimateBodyFatRfm({ heightCm: 200, waistCm: 50, gender: "MALE" })).toBe(0);
  });
});

describe("estimateBodyFatNavy", () => {
  it("men: 182 cm, waist 88, neck 39 -> 17.3 %", () => {
    expect(estimateBodyFatNavy({ heightCm: 182, waistCm: 88, neckCm: 39, gender: "MALE" })).toBe(17.3);
  });
  it("women need the hip: 165 cm, waist 82, hip 100, neck 33 -> 32.9 %", () => {
    expect(estimateBodyFatNavy({ heightCm: 165, waistCm: 82, neckCm: 33, hipCm: 100, gender: "FEMALE" })).toBe(32.9);
    expect(estimateBodyFatNavy({ heightCm: 165, waistCm: 82, neckCm: 33, gender: "FEMALE" })).toBeNull();
    expect(estimateBodyFatNavy({ heightCm: 165, waistCm: 82, neckCm: 33, hipCm: null, gender: "FEMALE" })).toBeNull();
  });
  it("ignores the hip for men and rejects a neck as wide as the waist", () => {
    expect(estimateBodyFatNavy({ heightCm: 182, waistCm: 88, neckCm: 39, hipCm: 120, gender: "MALE" })).toBe(17.3);
    expect(estimateBodyFatNavy({ heightCm: 182, waistCm: 40, neckCm: 40, gender: "MALE" })).toBeNull();
  });
});

describe("waistToHeightRatio", () => {
  it("divides waist by height", () => {
    expect(waistToHeightRatio(88, 182)).toBe(0.48);
    expect(waistToHeightRatio(0, 182)).toBeNull();
  });
});

describe("bodyFatRange", () => {
  it("spans both formulas", () => {
    expect(bodyFatRange({ heightCm: 182, gender: "MALE", waistCm: 88, neckCm: 39 })).toEqual({
      low: 17.3,
      high: 22.6,
      rfm: 22.6,
      navy: 17.3,
    });
  });
  it("collapses to RFM without a neck measurement", () => {
    expect(bodyFatRange({ heightCm: 182, gender: "MALE", waistCm: 88 })).toEqual({ low: 22.6, high: 22.6, rfm: 22.6, navy: null });
  });
  it("collapses to RFM for a woman without hip", () => {
    const range = bodyFatRange({ heightCm: 165, gender: "FEMALE", waistCm: 82, neckCm: 33 });
    expect(range).toEqual({ low: 35.8, high: 35.8, rfm: 35.8, navy: null });
  });
  it("has no range without a waist", () => {
    expect(bodyFatRange({ heightCm: 182, gender: "MALE", neckCm: 39 })).toBeNull();
  });
});

describe("applyCalibrationOffset", () => {
  it("moves both ends by the offset and clamps to 0-100", () => {
    expect(applyCalibrationOffset({ low: 17.3, high: 22.6 }, -2)).toEqual({ low: 15.3, high: 20.6 });
    expect(applyCalibrationOffset({ low: 1, high: 5 }, -3)).toEqual({ low: 0, high: 2 });
  });
});
