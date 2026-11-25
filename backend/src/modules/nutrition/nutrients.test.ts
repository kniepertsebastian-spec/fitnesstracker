import { describe, expect, it } from "vitest";
import {
  calculateRecipe,
  emptyNutrients,
  nutrientStatus,
  recipePortion,
  resolveAmount,
  roundNutrients,
  scaleNutrients,
  splitMacros,
  sumNutrients,
  UnitConversionError,
  type IngredientInput,
  type NutrientValues,
  type Nutrients,
} from "./nutrients.js";

const per100 = (v: Partial<Nutrients>, estimated: NutrientValues["estimated"] = []): NutrientValues => ({
  values: { ...emptyNutrients(), ...v },
  estimated,
});

const pasta: IngredientInput["food"] = {
  basis: "PER_100G",
  densityGPerMl: null,
  units: [],
  per100: per100({ kcal: 350, proteinG: 25, carbsG: 50, fatG: 3, fiberG: 8 }),
};
const chicken: IngredientInput["food"] = {
  basis: "PER_100G",
  densityGPerMl: null,
  units: [{ label: "Stück", baseAmount: 200 }],
  per100: per100({ kcal: 110, proteinG: 23.5, carbsG: 0, fatG: 1.5, fiberG: 0 }),
};
const tomatoes: IngredientInput["food"] = {
  basis: "PER_100G",
  densityGPerMl: null,
  units: [{ label: "Packung", baseAmount: 500 }],
  per100: per100({ kcal: 33, proteinG: 1.4, carbsG: 5.2, fatG: 0.3, fiberG: 1.1 }),
};
// Olive oil: values per 100 g, density 0.91 g/ml, and an explicit "EL" of 10 ml = 9.1 g.
const oliveOil: IngredientInput["food"] = {
  basis: "PER_100G",
  densityGPerMl: 0.91,
  units: [{ label: "EL", baseAmount: 9.1 }],
  per100: per100({ kcal: 899, proteinG: 0, carbsG: 0, fatG: 99.9, fiberG: 0 }),
};

const proteinPasta: IngredientInput[] = [
  { name: "Protein-Pasta, roh", quantity: 250, unitLabel: "g", food: pasta },
  { name: "Hähnchenbrust, roh", quantity: 2, unitLabel: "Stück", food: chicken },
  { name: "Passierte Tomaten", quantity: 1, unitLabel: "Packung", food: tomatoes },
  { name: "Olivenöl", quantity: 10, unitLabel: "ml", food: oliveOil },
];

// Expected totals, by hand from the raw amounts:
// kcal 875 + 440 + 165 + 81.809 = 1561.809, protein 62.5 + 94 + 7 + 0 = 163.5,
// carbs 125 + 0 + 26 + 0 = 151, fat 7.5 + 6 + 1.5 + 9.0909 = 24.0909, raw weight 1159.1 g.
const TOTAL_KCAL = 875 + 440 + 165 + 899 * 0.091;
const TOTAL_PROTEIN = 163.5;
const TOTAL_FAT = 7.5 + 6 + 1.5 + 99.9 * 0.091;
const RAW_WEIGHT = 250 + 400 + 500 + 9.1;

describe("resolveAmount", () => {
  it("converts 10 ml olive oil to 9.1 g via its density", () => {
    const amount = resolveAmount(oliveOil, 10, "ml");
    expect(amount.baseAmount).toBeCloseTo(9.1, 10);
    expect(amount.grams).toBeCloseTo(9.1, 10);
  });

  it("uses a household measure of the food (1 EL olive oil = 9.1 g)", () => {
    expect(resolveAmount(oliveOil, 2, "el")).toEqual({ baseAmount: 18.2, grams: 18.2 });
  });

  it("prefers the food's own unit over the built-in conversion", () => {
    const withMl = { ...oliveOil, densityGPerMl: null, units: [{ label: "ml", baseAmount: 0.91 }] };
    expect(resolveAmount(withMl, 10, "ml").grams).toBeCloseTo(9.1, 10);
  });

  it("handles foods per 100 ml (milk, density 1.03)", () => {
    const milk = { basis: "PER_100ML" as const, densityGPerMl: 1.03, units: [] };
    const ml = resolveAmount(milk, 250, "ml");
    expect(ml.baseAmount).toBe(250);
    expect(ml.grams).toBeCloseTo(257.5, 10);
    expect(resolveAmount(milk, 103, "g").baseAmount).toBeCloseTo(100, 10);
  });

  it("knows a half pack", () => {
    expect(resolveAmount(tomatoes, 0.5, "Packung")).toEqual({ baseAmount: 250, grams: 250 });
  });

  it("refuses to guess a density or an unknown unit", () => {
    expect(() => resolveAmount(pasta, 10, "ml")).toThrow(UnitConversionError);
    expect(() => resolveAmount({ basis: "PER_100ML", densityGPerMl: null, units: [] }, 10, "g")).toThrow(UnitConversionError);
    expect(() => resolveAmount(pasta, 1, "Tasse")).toThrow(UnitConversionError);
    expect(() => resolveAmount(pasta, -1, "g")).toThrow(UnitConversionError);
  });

  it("gives no grams for an ml food without density", () => {
    expect(resolveAmount({ basis: "PER_100ML", densityGPerMl: null, units: [] }, 200, "ml")).toEqual({ baseAmount: 200, grams: null });
  });
});

describe("scaleNutrients / sumNutrients", () => {
  it("keeps unknown values unknown when scaling", () => {
    const scaled = scaleNutrients(per100({ kcal: 200, fatG: null }), 50);
    expect(scaled.values.kcal).toBe(100);
    expect(scaled.values.fatG).toBeNull();
  });

  it("sums known parts and marks a key with unknown parts as estimated, never as zero", () => {
    const sum = sumNutrients([per100({ kcal: 100, fatG: 5 }), per100({ kcal: 50, fatG: null })]);
    expect(sum.values.kcal).toBe(150);
    expect(sum.values.fatG).toBe(5);
    expect(sum.estimated).toEqual(["fatG"]);
    expect(sum.values.fiberG).toBeNull();
    expect(nutrientStatus(sum.values, sum.estimated)).toMatchObject({ kcal: "verified", fatG: "estimated", fiberG: "unknown" });
  });

  it("carries estimates of the parts", () => {
    const sum = sumNutrients([per100({ saltG: 0 }, ["saltG"]), per100({ saltG: 1 })]);
    expect(sum.values.saltG).toBe(1);
    expect(sum.estimated).toEqual(["saltG"]);
  });

  it("rounds snapshots once (kcal 1 decimal, grams 2, salt 3)", () => {
    const r = roundNutrients(per100({ kcal: 81.809, fatG: 9.0909, saltG: 0.12345 }));
    expect(r.values).toMatchObject({ kcal: 81.8, fatG: 9.09, saltG: 0.123 });
  });
});

describe("calculateRecipe: protein pasta", () => {
  it("sums the raw ingredients (10 ml olive oil count as 9.1 g)", () => {
    const r = calculateRecipe(proteinPasta, { finalWeightG: 980, servings: 4 });
    expect(r.ingredients[3]!.rawWeightG).toBeCloseTo(9.1, 10);
    expect(r.ingredients[3]!.nutrients.values.kcal).toBeCloseTo(81.809, 6);
    expect(r.totalRawWeightG).toBeCloseTo(RAW_WEIGHT, 10);
    expect(r.totals.values.kcal).toBeCloseTo(TOTAL_KCAL, 6);
    expect(r.totals.values.proteinG).toBeCloseTo(TOTAL_PROTEIN, 6);
    expect(r.totals.values.carbsG).toBeCloseTo(151, 6);
    expect(r.totals.values.fatG).toBeCloseTo(TOTAL_FAT, 6);
    expect(r.totals.estimated).toEqual([]);
  });

  it("spreads the totals over the cooked weight (water lost: 1159.1 g raw -> 980 g)", () => {
    const r = calculateRecipe(proteinPasta, { finalWeightG: 980, servings: 4 });
    expect(r.weightSource).toBe("final");
    expect(r.effectiveWeightG).toBe(980);
    expect(r.cookingChangePercent).toBeCloseTo(((980 - RAW_WEIGHT) / RAW_WEIGHT) * 100, 6);
    // Same nutrients in less weight: more per 100 g than the raw mix.
    expect(r.per100g!.values.kcal).toBeCloseTo((TOTAL_KCAL / 980) * 100, 6);
    expect(r.per100g!.values.kcal).toBeCloseTo(159.368, 3);
    expect(r.per100g!.values.proteinG).toBeCloseTo(16.684, 3);
    expect(r.perServing!.values.kcal).toBeCloseTo(TOTAL_KCAL / 4, 6);
    expect(r.servingWeightG).toBe(245);
  });

  it("a weighed portion of 350 g gets 350/980 of the totals", () => {
    const r = calculateRecipe(proteinPasta, { finalWeightG: 980 });
    const portion = recipePortion(r.totals, r.effectiveWeightG, 350)!;
    expect(portion.values.kcal).toBeCloseTo(557.789, 3);
    expect(portion.values.proteinG).toBeCloseTo(58.393, 3);
  });

  it("handles water taken up while cooking (final weight above the raw sum)", () => {
    const r = calculateRecipe(proteinPasta, { finalWeightG: 1400 });
    expect(r.cookingChangePercent!).toBeGreaterThan(0);
    expect(r.per100g!.values.kcal).toBeCloseTo((TOTAL_KCAL / 1400) * 100, 6);
  });

  it("falls back to the raw sum without a final weight, and for a final weight of 0", () => {
    for (const finalWeightG of [undefined, null, 0, -5, Number.NaN]) {
      const r = calculateRecipe(proteinPasta, { finalWeightG });
      expect(r.weightSource).toBe("raw");
      expect(r.effectiveWeightG).toBeCloseTo(RAW_WEIGHT, 10);
      expect(r.cookingChangePercent).toBeNull();
      expect(r.per100g!.values.kcal).toBeCloseTo((TOTAL_KCAL / RAW_WEIGHT) * 100, 6);
    }
  });

  it("does not divide by zero for an empty recipe or 0 servings", () => {
    const r = calculateRecipe([], { finalWeightG: 0, servings: 0 });
    expect(r.totalRawWeightG).toBe(0);
    expect(r.per100g).toBeNull();
    expect(r.perServing).toBeNull();
    expect(r.servingWeightG).toBeNull();
    expect(r.totals.values.kcal).toBeNull();
    expect(recipePortion(r.totals, 0, 100)).toBeNull();
  });

  it("marks an ingredient without known fat instead of counting it as 0", () => {
    const unknownFat = { ...tomatoes, per100: per100({ kcal: 33, proteinG: 1.4, carbsG: 5.2, fatG: null }) };
    const r = calculateRecipe([proteinPasta[0]!, { ...proteinPasta[2]!, food: unknownFat }]);
    expect(r.totals.values.fatG).toBe(7.5);
    expect(r.totals.estimated).toContain("fatG");
  });

  it("marks the weight as estimated for an ml ingredient without density", () => {
    const broth = { basis: "PER_100ML" as const, densityGPerMl: null, units: [], per100: per100({ kcal: 5 }) };
    const r = calculateRecipe([{ name: "Brühe", quantity: 300, unitLabel: "ml", food: broth }]);
    expect(r.totalWeightEstimated).toBe(true);
    expect(r.totalRawWeightG).toBe(300);
  });
});

describe("splitMacros", () => {
  it("splits only what is left after protein", () => {
    // 2500 kcal, 160 g protein = 640 kcal, 1860 left: 40 % fat = 744 kcal (83 g), 1116 kcal carbs (279 g).
    expect(splitMacros(2500, 160, 40)).toEqual({
      proteinG: 160,
      proteinKcal: 640,
      fatG: 83,
      fatKcal: 744,
      carbsG: 279,
      carbsKcal: 1116,
      fatPercentOfRemaining: 40,
      proteinExceedsTarget: false,
    });
  });

  it("adds up to the calorie target", () => {
    const s = splitMacros(2213, 154, 35);
    expect(s.proteinKcal + s.fatKcal + s.carbsKcal).toBeGreaterThanOrEqual(2212);
    expect(s.proteinKcal + s.fatKcal + s.carbsKcal).toBeLessThanOrEqual(2214);
  });

  it("leaves nothing to split when protein alone exceeds the target", () => {
    const s = splitMacros(500, 150, 40);
    expect(s).toMatchObject({ fatG: 0, carbsG: 0, proteinExceedsTarget: true });
  });

  it("clamps the percentage", () => {
    expect(splitMacros(2000, 100, 150).fatPercentOfRemaining).toBe(100);
    expect(splitMacros(2000, 100, -10).carbsKcal).toBe(1600);
  });
});
