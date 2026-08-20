import { z } from "zod";

export const genderSchema = z.enum(["MALE", "FEMALE"]);
export type Gender = z.infer<typeof genderSchema>;

export const activityLevelSchema = z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]);
export type ActivityLevel = z.infer<typeof activityLevelSchema>;

export const nutritionGoalSchema = z.enum(["CUT", "MAINTAIN", "BULK"]);
export type NutritionGoal = z.infer<typeof nutritionGoalSchema>;

export const upsertProfileSchema = z.object({
  weightKg: z.number().positive().max(500),
  heightCm: z.number().int().positive().max(272),
  age: z.number().int().positive().max(120),
  gender: genderSchema,
  activityLevel: activityLevelSchema,
  goal: nutritionGoalSchema,
});
export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;

export const profileDtoSchema = z.object({
  weightKg: z.number(),
  heightCm: z.number(),
  age: z.number(),
  gender: genderSchema,
  activityLevel: activityLevelSchema,
  goal: nutritionGoalSchema,
  // Derived from the fields above (Mifflin-St Jeor) — never stored, always recomputed on read
  // so editing weightKg etc. can never leave a stale calculation behind.
  bmr: z.number(),
  tdee: z.number(),
  targetCalories: z.number(),
  targetProteinG: z.number(),
});
export type ProfileDto = z.infer<typeof profileDtoSchema>;
