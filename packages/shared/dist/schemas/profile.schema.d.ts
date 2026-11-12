import { z } from "zod";
export declare const genderSchema: z.ZodEnum<{
    MALE: "MALE";
    FEMALE: "FEMALE";
}>;
export type Gender = z.infer<typeof genderSchema>;
export declare const activityLevelSchema: z.ZodEnum<{
    SEDENTARY: "SEDENTARY";
    LIGHT: "LIGHT";
    MODERATE: "MODERATE";
    ACTIVE: "ACTIVE";
    VERY_ACTIVE: "VERY_ACTIVE";
}>;
export type ActivityLevel = z.infer<typeof activityLevelSchema>;
export declare const nutritionGoalSchema: z.ZodEnum<{
    CUT: "CUT";
    MAINTAIN: "MAINTAIN";
    BULK: "BULK";
}>;
export type NutritionGoal = z.infer<typeof nutritionGoalSchema>;
export declare const upsertProfileSchema: z.ZodObject<{
    weightKg: z.ZodNumber;
    heightCm: z.ZodNumber;
    age: z.ZodNumber;
    gender: z.ZodEnum<{
        MALE: "MALE";
        FEMALE: "FEMALE";
    }>;
    activityLevel: z.ZodEnum<{
        SEDENTARY: "SEDENTARY";
        LIGHT: "LIGHT";
        MODERATE: "MODERATE";
        ACTIVE: "ACTIVE";
        VERY_ACTIVE: "VERY_ACTIVE";
    }>;
    goal: z.ZodEnum<{
        CUT: "CUT";
        MAINTAIN: "MAINTAIN";
        BULK: "BULK";
    }>;
}, z.core.$strip>;
export type UpsertProfileInput = z.infer<typeof upsertProfileSchema>;
export declare const profileDtoSchema: z.ZodObject<{
    weightKg: z.ZodNumber;
    heightCm: z.ZodNumber;
    age: z.ZodNumber;
    gender: z.ZodEnum<{
        MALE: "MALE";
        FEMALE: "FEMALE";
    }>;
    activityLevel: z.ZodEnum<{
        SEDENTARY: "SEDENTARY";
        LIGHT: "LIGHT";
        MODERATE: "MODERATE";
        ACTIVE: "ACTIVE";
        VERY_ACTIVE: "VERY_ACTIVE";
    }>;
    goal: z.ZodEnum<{
        CUT: "CUT";
        MAINTAIN: "MAINTAIN";
        BULK: "BULK";
    }>;
    bmr: z.ZodNumber;
    tdee: z.ZodNumber;
    targetCalories: z.ZodNumber;
    targetProteinG: z.ZodNumber;
}, z.core.$strip>;
export type ProfileDto = z.infer<typeof profileDtoSchema>;
