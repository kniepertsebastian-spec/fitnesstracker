import { calculateNutrition } from "./profile.service.js";
export function toProfileDto(profile) {
    const { bmr, tdee, targetCalories, targetProteinG } = calculateNutrition(profile);
    return {
        weightKg: Number(profile.weightKg),
        heightCm: profile.heightCm,
        age: profile.age,
        gender: profile.gender,
        activityLevel: profile.activityLevel,
        goal: profile.goal,
        bmr,
        tdee,
        targetCalories,
        targetProteinG,
    };
}
//# sourceMappingURL=profile.types.js.map