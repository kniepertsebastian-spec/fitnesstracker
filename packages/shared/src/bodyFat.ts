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
