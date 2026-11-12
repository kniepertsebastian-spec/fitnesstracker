import type { Gender } from "./schemas/profile.schema.js";

export interface BodyFatEstimateInput {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
}

// CUN-BAE (Clínica Universidad de Navarra – Body Adiposity Estimator): body fat % from BMI, age
// and sex alone, fitted against air-displacement plethysmography in 6,510 adults — including
// people with obesity, where simple linear BMI formulas drift. Sex is coded male = 0, female = 1.
//   Gómez-Ambrosi J et al.: Clinical usefulness of a new equation for estimating body fat.
//   Diabetes Care 2012; 35(2): 383–388.
// It knows nothing about muscle: very muscular people are overestimated (one DXA study in
// athletes found fat mass overestimated), so it is a plausibility check for a scale reading,
// not a measurement.
export function estimateBodyFatCunBae({ weightKg, heightCm, age, gender }: BodyFatEstimateInput): number | null {
  if (![weightKg, heightCm, age].every((n) => Number.isFinite(n) && n > 0)) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  const sex = gender === "FEMALE" ? 1 : 0;
  const percent =
    -44.988 +
    0.503 * age +
    10.689 * sex +
    3.172 * bmi -
    0.026 * bmi ** 2 +
    0.181 * bmi * sex -
    0.02 * bmi * age -
    0.005 * bmi ** 2 * sex +
    0.00021 * bmi ** 2 * age;
  if (!Number.isFinite(percent)) return null;
  return Math.round(Math.min(Math.max(percent, 0), 100) * 10) / 10;
}

// Fat-free mass index: fat-free mass (kg) per m² of height. Natural, well-trained people rarely
// exceed about 25 kg/m²; a scale reading that implies a clearly higher value is more likely a
// body-fat reading that is too low than an exceptional physique.
export function fatFreeMassIndex(weightKg: number, bodyFatPercent: number, heightCm: number): number | null {
  if (![weightKg, heightCm].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (!Number.isFinite(bodyFatPercent) || bodyFatPercent < 0 || bodyFatPercent >= 100) return null;
  return Math.round(((weightKg * (1 - bodyFatPercent / 100)) / (heightCm / 100) ** 2) * 10) / 10;
}

// Above this FFMI a reading is flagged as implausible for a natural physique.
export const FFMI_NATURAL_LIMIT = 25;
// A scale value this many percentage points below the CUN-BAE estimate is worth a second look
// (the equation's own error is around 4–5 points, so a gap this size is not just noise).
export const BODY_FAT_GAP_THRESHOLD = 8;

// ---------------------------------------------------------------------------------------------
// Tape-measure estimates. They need no model of muscle mass and, unlike CUN-BAE, do not drift for
// people who train. Each has an error of roughly 3–5 percentage points against DEXA, so the app
// shows the range of both instead of one precise-looking number.
// ---------------------------------------------------------------------------------------------

const round1 = (value: number) => Math.round(value * 10) / 10;
const positive = (...values: Array<number | null | undefined>) =>
  values.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
const clampPercent = (value: number) => round1(Math.min(Math.max(value, 0), 100));

export interface TapeMeasureInput {
  heightCm: number;
  waistCm: number;
  gender: Gender;
}

// Relative Fat Mass (Woolcott & Bergman, Scientific Reports 2018, validated against DEXA):
//   body fat % = 64 − 20 × height / waist   (women: 76 instead of 64)
export function estimateBodyFatRfm({ heightCm, waistCm, gender }: TapeMeasureInput): number | null {
  if (!positive(heightCm, waistCm)) return null;
  const constant = gender === "FEMALE" ? 76 : 64;
  return clampPercent(constant - (20 * heightCm) / waistCm);
}

export interface NavyInput extends TapeMeasureInput {
  neckCm: number;
  /** Required for women, ignored for men. */
  hipCm?: number | null;
}

// US Navy circumference method (Hodgdon & Beckett, Naval Health Research Center 1984), all in cm:
//   men:   495 / (1.0324 − 0.19077 × log10(waist − neck) + 0.15456 × log10(height)) − 450
//   women: 495 / (1.29579 − 0.35004 × log10(waist + hip − neck) + 0.22100 × log10(height)) − 450
export function estimateBodyFatNavy({ heightCm, waistCm, neckCm, hipCm, gender }: NavyInput): number | null {
  if (!positive(heightCm, waistCm, neckCm)) return null;
  let percent: number;
  if (gender === "FEMALE") {
    if (!positive(hipCm)) return null;
    const girth = waistCm + (hipCm as number) - neckCm;
    if (girth <= 0) return null;
    percent = 495 / (1.29579 - 0.35004 * Math.log10(girth) + 0.221 * Math.log10(heightCm)) - 450;
  } else {
    const girth = waistCm - neckCm;
    if (girth <= 0) return null;
    percent = 495 / (1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  if (!Number.isFinite(percent)) return null;
  return clampPercent(percent);
}

/** Waist-to-height ratio (two decimals). Below 0.5 is the usual rule of thumb for low health risk. */
export function waistToHeightRatio(waistCm: number, heightCm: number): number | null {
  if (!positive(waistCm, heightCm)) return null;
  return Math.round((waistCm / heightCm) * 100) / 100;
}

export interface BodyFatRange {
  /** Lower and upper end across the formulas that could be computed. */
  low: number;
  high: number;
  rfm: number | null;
  navy: number | null;
}

export interface BodyFatRangeInput {
  heightCm: number;
  gender: Gender;
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
}

// Range across RFM and US Navy. With only one formula computable (no neck, or a woman without hip
// measurement) the range collapses to that value; with no waist there is no range.
export function bodyFatRange({ heightCm, gender, waistCm, neckCm, hipCm }: BodyFatRangeInput): BodyFatRange | null {
  if (!positive(waistCm)) return null;
  const rfm = estimateBodyFatRfm({ heightCm, waistCm: waistCm as number, gender });
  const navy = positive(neckCm)
    ? estimateBodyFatNavy({ heightCm, waistCm: waistCm as number, neckCm: neckCm as number, hipCm, gender })
    : null;
  const values = [rfm, navy].filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return { low: Math.min(...values), high: Math.max(...values), rfm, navy };
}
