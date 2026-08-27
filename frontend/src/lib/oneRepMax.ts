// Estimated one-rep max, averaging the two most common formulas (Epley and Brzycki) rather than
// picking one — they diverge more the higher the rep count goes, and the average is a reasonable
// middle ground for a rough "how strong am I really" estimate, not a precise value either formula
// alone would overclaim.
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return weightKg;

  const epley = weightKg * (1 + reps / 30);
  // Brzycki's denominator (37 - reps) goes to zero/negative at reps >= 37 — fall back to Epley
  // alone up there rather than dividing by zero or averaging in a negative number.
  const brzycki = reps < 37 ? (weightKg * 36) / (37 - reps) : epley;
  return (epley + brzycki) / 2;
}

export interface WarmupStep {
  percent: number;
  weightKg: number;
  reps: number;
}

const WARMUP_STEPS = [
  { percent: 40, reps: 8 },
  { percent: 60, reps: 5 },
  { percent: 80, reps: 3 },
  { percent: 90, reps: 1 },
];

// A generic percentage-of-working-weight ramp, not personalized to the lifter — a reasonable
// default suggestion, not a program.
export function buildWarmupPyramid(targetWeightKg: number): WarmupStep[] {
  if (targetWeightKg <= 0) return [];
  return WARMUP_STEPS.map((step) => ({
    percent: step.percent,
    weightKg: Math.round(targetWeightKg * (step.percent / 100) * 2) / 2,
    reps: step.reps,
  }));
}
