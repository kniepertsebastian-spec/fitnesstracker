import { z } from "zod";
export const genderSchema = z.enum(["MALE", "FEMALE"]);
export const activityLevelSchema = z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]);
export const nutritionGoalSchema = z.enum(["CUT", "MAINTAIN", "BULK"]);
export const upsertProfileSchema = z.object({
    weightKg: z.number().positive().max(500),
    heightCm: z.number().int().positive().max(272),
    age: z.number().int().positive().max(120),
    gender: genderSchema,
    activityLevel: activityLevelSchema,
    goal: nutritionGoalSchema,
});
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
//# sourceMappingURL=profile.schema.js.map