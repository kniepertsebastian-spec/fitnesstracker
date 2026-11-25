import type { NutrientBasis, NutrientKey, Nutrients } from "../nutrition/nutrients.js";

// Plausibility check for nutrient values read from a photo (Scan & Learn). It never changes a
// value; it only says which fields the user should look at again before saving.
//
// Energy: EU labels compute kcal as 4 * protein + 4 * carbohydrates + 9 * fat + 2 * fibre
// (+ 2.4 * polyols + 7 * alcohol, which labels rarely list separately). Fibre is added when it is
// known. The tolerance covers rounding on the label and the polyol/alcohol share of ordinary
// products: max(15 kcal, 12 % of the stated value). A larger gap marks kcal and the three macros:
// from the numbers alone it cannot be told which of them was misread.

export const KCAL_TOLERANCE_ABS = 15;
export const KCAL_TOLERANCE_REL = 0.12;

export type PlausibilityIssueCode = "kcal_mismatch" | "sugar_above_carbs" | "saturated_above_fat" | "mass_above_100" | "kcal_above_max";

export interface PlausibilityIssue {
  code: PlausibilityIssueCode;
  message: string;
  fields: NutrientKey[];
}

export interface PlausibilityResult {
  /** False when kcal or a macro is unknown: the energy check could not run. */
  energyChecked: boolean;
  statedKcal: number | null;
  expectedKcal: number | null;
  deviationKcal: number | null;
  deviationPercent: number | null;
  ok: boolean;
  issues: PlausibilityIssue[];
  suspiciousFields: NutrientKey[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function expectedKcal(n: Pick<Nutrients, "proteinG" | "carbsG" | "fatG" | "fiberG">): number | null {
  if (n.proteinG === null || n.carbsG === null || n.fatG === null) return null;
  return 4 * n.proteinG + 4 * n.carbsG + 9 * n.fatG + 2 * (n.fiberG ?? 0);
}

export function checkPlausibility(n: Nutrients, basis: NutrientBasis = "PER_100G"): PlausibilityResult {
  const issues: PlausibilityIssue[] = [];
  const expected = expectedKcal(n);
  const stated = n.kcal;
  let deviationKcal: number | null = null;
  let deviationPercent: number | null = null;

  if (expected !== null && stated !== null) {
    deviationKcal = round1(stated - expected);
    deviationPercent = stated > 0 ? round1((Math.abs(stated - expected) / stated) * 100) : null;
    const tolerance = Math.max(KCAL_TOLERANCE_ABS, KCAL_TOLERANCE_REL * stated);
    if (Math.abs(stated - expected) > tolerance) {
      issues.push({
        code: "kcal_mismatch",
        message: `Die Makros ergeben ${Math.round(expected)} kcal, angegeben sind ${Math.round(stated)} kcal.`,
        fields: ["kcal", "proteinG", "carbsG", "fatG"],
      });
    }
  }
  if (n.sugarG !== null && n.carbsG !== null && n.sugarG > n.carbsG + 0.5) {
    issues.push({ code: "sugar_above_carbs", message: "Mehr Zucker als Kohlenhydrate ist nicht möglich.", fields: ["sugarG", "carbsG"] });
  }
  if (n.saturatedFatG !== null && n.fatG !== null && n.saturatedFatG > n.fatG + 0.5) {
    issues.push({ code: "saturated_above_fat", message: "Mehr gesättigte Fettsäuren als Fett ist nicht möglich.", fields: ["saturatedFatG", "fatG"] });
  }
  // Per 100 g the macros cannot weigh more than 100 g (per 100 ml they can, a little: density).
  if (basis === "PER_100G") {
    const mass = (n.proteinG ?? 0) + (n.carbsG ?? 0) + (n.fatG ?? 0) + (n.fiberG ?? 0) + (n.saltG ?? 0);
    if (mass > 101) {
      issues.push({ code: "mass_above_100", message: `Die Nährstoffe wiegen zusammen ${round1(mass)} g pro 100 g.`, fields: ["proteinG", "carbsG", "fatG", "fiberG", "saltG"].filter((k) => n[k as NutrientKey] !== null) as NutrientKey[] });
    }
  }
  // Pure fat has 900 kcal per 100 g; nothing edible has more.
  if (stated !== null && stated > 900) {
    issues.push({ code: "kcal_above_max", message: "Mehr als 900 kcal pro 100 g gibt es nicht.", fields: ["kcal"] });
  }

  const suspicious = new Set<NutrientKey>(issues.flatMap((i) => i.fields));
  return {
    energyChecked: expected !== null && stated !== null,
    statedKcal: stated,
    expectedKcal: expected === null ? null : round1(expected),
    deviationKcal,
    deviationPercent,
    ok: issues.length === 0,
    issues,
    suspiciousFields: [...suspicious],
  };
}
