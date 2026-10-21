// Rough estimate of the energy spent on lifting, per set and per exercise. It is deliberately
// simple and says "≈" everywhere: real expenditure varies a lot with technique, tempo and
// individual efficiency (±30–50 % is normal), and the rest between sets is not counted.
//
// Two parts per set:
//  1. Mechanical work: load × g × range of motion × reps, with the lowering phase counted at
//     about a third of the lifting cost, divided by the muscles' efficiency (~22 %). The range of
//     motion scales with body height (longer limbs travel further).
//  2. Muscle activation and bracing during the time under tension: 3 MET above rest, where
//     resting metabolic rate comes from Mifflin-St Jeor (weight, height, age, sex).

export interface BodyProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: "MALE" | "FEMALE";
}

const GRAVITY = 9.81;
const MUSCLE_EFFICIENCY = 0.22;
const LOWERING_FACTOR = 1.33; // lifting + lowering at ~1/3 of the lifting cost
const RANGE_OF_MOTION_PER_HEIGHT = 0.25; // metres of bar travel per metre of body height
const SECONDS_PER_REP = 3;
const ACTIVATION_MET_ABOVE_REST = 3;
// Exercises logged with 0 kg are body-weight exercises: they move roughly this share of the body.
const BODYWEIGHT_SHARE = 0.6;
const JOULES_PER_KCAL = 4184;

// Resting energy use in kcal per day (Mifflin-St Jeor).
export function restingKcalPerDay(profile: BodyProfile): number {
  return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.gender === "MALE" ? 5 : -161);
}

export function setKcal(profile: BodyProfile, set: { weightKg: number; reps: number }): number {
  if (set.reps <= 0) return 0;
  const load = set.weightKg > 0 ? set.weightKg : BODYWEIGHT_SHARE * profile.weightKg;
  const rangeOfMotionM = (profile.heightCm / 100) * RANGE_OF_MOTION_PER_HEIGHT;
  const workJoules = (load * GRAVITY * rangeOfMotionM * set.reps * LOWERING_FACTOR) / MUSCLE_EFFICIENCY;
  const activationKcal =
    ACTIVATION_MET_ABOVE_REST * (restingKcalPerDay(profile) / 24) * ((set.reps * SECONDS_PER_REP) / 3600);
  return Math.max(0, workJoules / JOULES_PER_KCAL + activationKcal);
}

export function setsKcal(profile: BodyProfile, sets: { weightKg: number; reps: number }[]): number {
  return sets.reduce((sum, set) => sum + setKcal(profile, set), 0);
}

export function formatKcal(kcal: number): string {
  return `≈ ${Math.round(kcal).toLocaleString("de-DE")} kcal`;
}
