import { describe, expect, it } from "vitest";
import { emptyNutrients, type Nutrients } from "../nutrition/nutrients.js";
import { checkPlausibility, expectedKcal } from "./plausibility.js";

const n = (values: Partial<Nutrients>): Nutrients => ({ ...emptyNutrients(), ...values });

describe("expectedKcal", () => {
  it("is 4 P + 4 C + 9 F + 2 fibre", () => {
    expect(expectedKcal(n({ proteinG: 10, carbsG: 20, fatG: 5, fiberG: 3 }))).toBe(40 + 80 + 45 + 6);
  });
  it("is unknown without one of the macros", () => {
    expect(expectedKcal(n({ proteinG: 10, carbsG: null, fatG: 5 }))).toBeNull();
  });
});

describe("checkPlausibility", () => {
  it("accepts a real label (Magerquark, BLS)", () => {
    const r = checkPlausibility(n({ kcal: 66, proteinG: 11.85, carbsG: 3.68, fatG: 0.18 }));
    expect(r.ok).toBe(true);
    expect(r.energyChecked).toBe(true);
    expect(r.suspiciousFields).toEqual([]);
  });

  it("accepts olive oil at 899 kcal", () => {
    expect(checkPlausibility(n({ kcal: 899, proteinG: 0, carbsG: 0, fatG: 99.9 })).ok).toBe(true);
  });

  it("allows small rounding differences on low-calorie foods", () => {
    // Expected 4*0.5 + 4*0.5 + 0 = 4, stated 15: within the 15 kcal absolute tolerance.
    expect(checkPlausibility(n({ kcal: 15, proteinG: 0.5, carbsG: 0.5, fatG: 0 })).ok).toBe(true);
  });

  it("flags kcal that do not fit the macros and marks the fields yellow", () => {
    // A misread digit: 452 instead of 152 kcal for 10 / 20 / 4.
    const r = checkPlausibility(n({ kcal: 452, proteinG: 10, carbsG: 20, fatG: 4 }));
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(["kcal_mismatch"]);
    expect(r.suspiciousFields).toEqual(expect.arrayContaining(["kcal", "proteinG", "carbsG", "fatG"]));
    expect(r.expectedKcal).toBe(156);
    expect(r.deviationKcal).toBe(296);
  });

  it("flags a kJ value read as kcal", () => {
    // 1000 kJ = 239 kcal; the macros fit 239.
    expect(checkPlausibility(n({ kcal: 1000, proteinG: 10, carbsG: 30, fatG: 8 })).ok).toBe(false);
  });

  it("does not check energy when a macro is unknown, and says so", () => {
    const r = checkPlausibility(n({ kcal: 300, proteinG: 10, carbsG: null, fatG: 5 }));
    expect(r.energyChecked).toBe(false);
    expect(r.expectedKcal).toBeNull();
    expect(r.issues).toEqual([]);
  });

  it("flags sugar above carbs and saturated above fat", () => {
    const r = checkPlausibility(n({ kcal: 200, proteinG: 5, carbsG: 30, fatG: 6.5, sugarG: 45, saturatedFatG: 9 }));
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["sugar_above_carbs", "saturated_above_fat"]));
    expect(r.suspiciousFields).toEqual(expect.arrayContaining(["sugarG", "carbsG", "saturatedFatG", "fatG"]));
  });

  it("flags more than 100 g of nutrients per 100 g, but not per 100 ml", () => {
    const values = n({ kcal: 500, proteinG: 60, carbsG: 50, fatG: 0 });
    expect(checkPlausibility(values, "PER_100G").issues.map((i) => i.code)).toContain("mass_above_100");
    expect(checkPlausibility(values, "PER_100ML").issues.map((i) => i.code)).not.toContain("mass_above_100");
  });

  it("flags more than 900 kcal per 100 g", () => {
    expect(checkPlausibility(n({ kcal: 950 })).issues.map((i) => i.code)).toEqual(["kcal_above_max"]);
  });
});
