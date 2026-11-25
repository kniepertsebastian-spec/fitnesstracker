// Nutrient arithmetic for the Kalorientracker: amounts and household measures, scaling per-100
// values to an eaten amount, sums, recipes (raw vs. final weight) and the macro split of the
// calorie target. Pure functions, no database: everything here is covered by nutrients.test.ts.
//
// Unknown is not zero. A nutrient that a source does not state is `null` and stays null when it
// is scaled. In a sum, the known parts are added up and the key is reported as estimated: the
// result is then a lower bound, not an exact value. Nothing is invented to fill a gap.

export const NUTRIENT_KEYS = ["kcal", "proteinG", "carbsG", "fatG", "fiberG", "sugarG", "saturatedFatG", "saltG"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];
export type Nutrients = Record<NutrientKey, number | null>;
export type NutrientStatus = "verified" | "estimated" | "unknown";

// Values plus the keys that are only estimates (trace values, AI guesses, sums with unknown parts).
export interface NutrientValues {
  values: Nutrients;
  estimated: NutrientKey[];
}

export type NutrientBasis = "PER_100G" | "PER_100ML";

export interface FoodUnitLike {
  label: string;
  // Amount in the food's basis unit (g, or ml for PER_100ML) that one unit stands for.
  baseAmount: number;
}

export interface FoodForAmount {
  basis: NutrientBasis;
  densityGPerMl: number | null;
  units: FoodUnitLike[];
}

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitConversionError";
  }
}

export function emptyNutrients(): Nutrients {
  return { kcal: null, proteinG: null, carbsG: null, fatG: null, fiberG: null, sugarG: null, saturatedFatG: null, saltG: null };
}

export function nutrientStatus(values: Nutrients, estimated: readonly string[]): Record<NutrientKey, NutrientStatus> {
  const status = {} as Record<NutrientKey, NutrientStatus>;
  for (const key of NUTRIENT_KEYS) {
    status[key] = values[key] === null ? "unknown" : estimated.includes(key) ? "estimated" : "verified";
  }
  return status;
}

export function onlyNutrientKeys(keys: readonly string[]): NutrientKey[] {
  return NUTRIENT_KEYS.filter((key) => keys.includes(key));
}

const normalizeLabel = (label: string) => label.trim().toLowerCase();

// Turns "3 EL", "10 ml" or "0.5 Packung" into the amount in the food's basis unit and, where it
// can be known, in grams. A measure of the food itself wins over the built-in g/ml conversion,
// so a stored "ml = 0.91 g" for olive oil is used as is. Throws when the unit cannot be converted
// (e.g. ml for a food per 100 g without density): guessing a density would invent a value.
export function resolveAmount(food: FoodForAmount, quantity: number, unitLabel: string): { baseAmount: number; grams: number | null } {
  if (!Number.isFinite(quantity) || quantity < 0) throw new UnitConversionError("Menge muss eine Zahl >= 0 sein");
  const label = normalizeLabel(unitLabel);
  const density = food.densityGPerMl && food.densityGPerMl > 0 ? food.densityGPerMl : null;
  const toGrams = (baseAmount: number) => (food.basis === "PER_100G" ? baseAmount : density ? baseAmount * density : null);

  const unit = food.units.find((u) => normalizeLabel(u.label) === label);
  if (unit) {
    const baseAmount = quantity * unit.baseAmount;
    return { baseAmount, grams: toGrams(baseAmount) };
  }
  if (label === "g") {
    if (food.basis === "PER_100G") return { baseAmount: quantity, grams: quantity };
    if (!density) throw new UnitConversionError("Gramm lassen sich ohne Dichte nicht in ml umrechnen");
    return { baseAmount: quantity / density, grams: quantity };
  }
  if (label === "ml") {
    if (food.basis === "PER_100ML") return { baseAmount: quantity, grams: toGrams(quantity) };
    if (!density) throw new UnitConversionError("ml lassen sich ohne Dichte nicht in Gramm umrechnen");
    return { baseAmount: quantity * density, grams: quantity * density };
  }
  throw new UnitConversionError(`Unbekannte Einheit „${unitLabel}“ für dieses Lebensmittel`);
}

// Per-100 values scaled to an amount in the basis unit.
export function scaleNutrients(per100: NutrientValues, baseAmount: number): NutrientValues {
  const values = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    const v = per100.values[key];
    values[key] = v === null ? null : (v * baseAmount) / 100;
  }
  return { values, estimated: onlyNutrientKeys(per100.estimated) };
}

// Adds up parts. A key is null only if no part knows it; if some parts know it and others do
// not, the known sum is returned and the key is marked estimated (a lower bound).
export function sumNutrients(parts: readonly NutrientValues[]): NutrientValues {
  const values = emptyNutrients();
  const estimated = new Set<NutrientKey>();
  for (const key of NUTRIENT_KEYS) {
    let sum: number | null = null;
    let missing = false;
    for (const part of parts) {
      const v = part.values[key];
      if (v === null) {
        missing = true;
        continue;
      }
      sum = (sum ?? 0) + v;
      if (part.estimated.includes(key)) estimated.add(key);
    }
    values[key] = sum;
    if (missing && sum !== null) estimated.add(key);
  }
  return { values, estimated: NUTRIENT_KEYS.filter((k) => estimated.has(k)) };
}

export function multiplyNutrients(n: NutrientValues, factor: number): NutrientValues {
  const values = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    const v = n.values[key];
    values[key] = v === null ? null : v * factor;
  }
  return { values, estimated: [...n.estimated] };
}

// Stored snapshots: kcal to 1 decimal, grams to 2 (salt to 3, it is small). Rounded once, when
// the snapshot is taken.
const DECIMALS: Record<NutrientKey, number> = {
  kcal: 1,
  proteinG: 2,
  carbsG: 2,
  fatG: 2,
  fiberG: 2,
  sugarG: 2,
  saturatedFatG: 2,
  saltG: 3,
};

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function roundNutrients(n: NutrientValues): NutrientValues {
  const values = emptyNutrients();
  for (const key of NUTRIENT_KEYS) {
    const v = n.values[key];
    values[key] = v === null ? null : roundTo(v, DECIMALS[key]);
  }
  return { values, estimated: [...n.estimated] };
}

// ─── Recipes ───────────────────────────────────────────────────────────────────────────────────

export interface IngredientInput {
  name: string;
  quantity: number;
  unitLabel: string;
  food: FoodForAmount & { per100: NutrientValues };
}

export interface IngredientResult {
  name: string;
  quantity: number;
  unitLabel: string;
  baseAmount: number;
  rawWeightG: number;
  // True when the weight of an ml-based ingredient without density was taken as 1 g/ml.
  weightEstimated: boolean;
  nutrients: NutrientValues;
}

export function calculateIngredient(input: IngredientInput): IngredientResult {
  const { baseAmount, grams } = resolveAmount(input.food, input.quantity, input.unitLabel);
  return {
    name: input.name,
    quantity: input.quantity,
    unitLabel: input.unitLabel,
    baseAmount,
    rawWeightG: grams ?? baseAmount,
    weightEstimated: grams === null,
    nutrients: scaleNutrients(input.food.per100, baseAmount),
  };
}

export interface RecipeResult {
  ingredients: IngredientResult[];
  totals: NutrientValues;
  totalRawWeightG: number;
  // The weight the per-100 g and portion values refer to: the weighed final weight, or the raw
  // sum when none was given (or it was 0).
  effectiveWeightG: number;
  weightSource: "final" | "raw";
  totalWeightEstimated: boolean;
  // Weight change from cooking, in percent of the raw weight (negative: water lost).
  cookingChangePercent: number | null;
  per100g: NutrientValues | null;
  perServing: NutrientValues | null;
  servingWeightG: number | null;
}

// 1. Sum the nutrients from the raw ingredient amounts. 2. Spread them over the actual weight of
// the cooked dish (water lost or absorbed while cooking changes the weight, not the nutrients).
// 3. The caller stores the result as the recipe's snapshot.
export function calculateRecipe(
  ingredients: readonly IngredientInput[],
  options: { finalWeightG?: number | null; servings?: number | null } = {},
): RecipeResult {
  const results = ingredients.map(calculateIngredient);
  const totals = sumNutrients(results.map((r) => r.nutrients));
  const totalRawWeightG = results.reduce((sum, r) => sum + r.rawWeightG, 0);
  const finalWeightG = options.finalWeightG ?? null;
  const useFinal = finalWeightG !== null && Number.isFinite(finalWeightG) && finalWeightG > 0;
  const effectiveWeightG = useFinal ? finalWeightG : totalRawWeightG;
  const servings = options.servings && options.servings > 0 ? options.servings : null;

  return {
    ingredients: results,
    totals,
    totalRawWeightG,
    effectiveWeightG,
    weightSource: useFinal ? "final" : "raw",
    totalWeightEstimated: results.some((r) => r.weightEstimated),
    cookingChangePercent: useFinal && totalRawWeightG > 0 ? ((finalWeightG - totalRawWeightG) / totalRawWeightG) * 100 : null,
    // Division by zero guarded: an empty or weightless recipe has no per-100 g values.
    per100g: effectiveWeightG > 0 ? multiplyNutrients(totals, 100 / effectiveWeightG) : null,
    perServing: servings ? multiplyNutrients(totals, 1 / servings) : null,
    servingWeightG: servings && effectiveWeightG > 0 ? effectiveWeightG / servings : null,
  };
}

// Nutrients of an eaten amount of a recipe, given the stored totals and the weight they refer to.
export function recipePortion(totals: NutrientValues, effectiveWeightG: number, eatenGrams: number): NutrientValues | null {
  if (!(effectiveWeightG > 0) || !(eatenGrams >= 0)) return null;
  return multiplyNutrients(totals, eatenGrams / effectiveWeightG);
}

// ─── Targets ───────────────────────────────────────────────────────────────────────────────────

export interface MacroSplit {
  proteinG: number;
  proteinKcal: number;
  fatG: number;
  fatKcal: number;
  carbsG: number;
  carbsKcal: number;
  fatPercentOfRemaining: number;
  // Protein alone already reaches the calorie target: nothing left to split.
  proteinExceedsTarget: boolean;
}

// The calorie and protein targets come from the Fitnesstracker profile. Only what is left after
// protein (4 kcal/g) is split between fat (9 kcal/g) and carbohydrates (4 kcal/g). No activity
// calories are added: the target already contains the activity level.
export function splitMacros(targetCalories: number, targetProteinG: number, fatPercentOfRemaining: number): MacroSplit {
  const pct = Math.min(100, Math.max(0, fatPercentOfRemaining));
  const proteinKcal = targetProteinG * 4;
  const remaining = Math.max(0, targetCalories - proteinKcal);
  const fatKcal = (remaining * pct) / 100;
  const carbsKcal = remaining - fatKcal;
  return {
    proteinG: targetProteinG,
    proteinKcal: Math.round(proteinKcal),
    fatG: Math.round(fatKcal / 9),
    fatKcal: Math.round(fatKcal),
    carbsG: Math.round(carbsKcal / 4),
    carbsKcal: Math.round(carbsKcal),
    fatPercentOfRemaining: pct,
    proteinExceedsTarget: proteinKcal > targetCalories,
  };
}
