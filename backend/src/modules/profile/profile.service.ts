import type { PrismaClient, Profile } from "@prisma/client";
import type { UpsertProfileInput } from "@fitnesstracker/shared";

const ACTIVITY_MULTIPLIERS: Record<Profile["activityLevel"], number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

// A conservative ~0.5kg/week deficit for CUT and a lean, muscle-preserving surplus for BULK —
// aggressive numbers here just mean more muscle loss (cut) or more fat gain (bulk) for no extra
// benefit, so there's no "advanced" tier worth adding on top of these.
const CALORIE_ADJUSTMENT: Record<Profile["goal"], number> = {
  CUT: -500,
  MAINTAIN: 0,
  BULK: 300,
};

// Protein target scales with bodyweight, not calories — higher while cutting to protect
// muscle mass in a deficit, still comfortably above the RDA everywhere else.
const PROTEIN_G_PER_KG: Record<Profile["goal"], number> = {
  CUT: 2.2,
  MAINTAIN: 1.8,
  BULK: 1.6,
};

export function getProfile(prisma: PrismaClient, userId: string) {
  return prisma.profile.findUnique({ where: { userId } });
}

// Always a full replace, never a partial patch — the fields only make sense together (you can't
// meaningfully "just update the goal" without the rest), so there's no separate PATCH endpoint.
export function upsertProfile(prisma: PrismaClient, userId: string, input: UpsertProfileInput) {
  return prisma.profile.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
}

export interface NutritionCalculation {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProteinG: number;
}

// Mifflin-St Jeor — the resting-metabolism formula with the best accuracy across a wide BMI
// range in modern validation studies (more so than the older Harris-Benedict equation).
export function calculateNutrition(profile: Profile): NutritionCalculation {
  const weight = Number(profile.weightKg);
  const sexOffset = profile.gender === "MALE" ? 5 : -161;
  const bmr = 10 * weight + 6.25 * profile.heightCm - 5 * profile.age + sexOffset;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel];
  const targetCalories = tdee + CALORIE_ADJUSTMENT[profile.goal];
  const targetProteinG = weight * PROTEIN_G_PER_KG[profile.goal];

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    targetProteinG: Math.round(targetProteinG),
  };
}
