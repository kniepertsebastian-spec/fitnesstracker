import { z } from "zod";
export declare const STRETCH_FOCUS_MUSCLES: readonly ["neck", "shoulders", "chest", "biceps", "triceps", "forearms", "lats", "middle back", "lower back", "traps", "abdominals", "glutes", "abductors", "adductors", "quadriceps", "hamstrings", "calves"];
export type StretchFocusMuscle = (typeof STRETCH_FOCUS_MUSCLES)[number];
export declare const stretchFocusMuscleSchema: z.ZodEnum<{
    neck: "neck";
    shoulders: "shoulders";
    chest: "chest";
    biceps: "biceps";
    triceps: "triceps";
    forearms: "forearms";
    lats: "lats";
    "middle back": "middle back";
    "lower back": "lower back";
    traps: "traps";
    abdominals: "abdominals";
    glutes: "glutes";
    abductors: "abductors";
    adductors: "adductors";
    quadriceps: "quadriceps";
    hamstrings: "hamstrings";
    calves: "calves";
}>;
export declare const STRETCH_FOCUS_LABELS: Record<StretchFocusMuscle, string>;
export declare const stretchItemDtoSchema: z.ZodObject<{
    exerciseId: z.ZodString;
    name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    imageUrls: z.ZodArray<z.ZodString>;
    primaryMuscles: z.ZodArray<z.ZodString>;
    holdSeconds: z.ZodNumber;
    sets: z.ZodNumber;
}, z.core.$strip>;
export type StretchItemDto = z.infer<typeof stretchItemDtoSchema>;
export declare const stretchDayDtoSchema: z.ZodObject<{
    dayLabel: z.ZodNullable<z.ZodString>;
    muscles: z.ZodArray<z.ZodString>;
    source: z.ZodEnum<{
        auto: "auto";
        ai: "ai";
    }>;
    items: z.ZodArray<z.ZodObject<{
        exerciseId: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        imageUrls: z.ZodArray<z.ZodString>;
        primaryMuscles: z.ZodArray<z.ZodString>;
        holdSeconds: z.ZodNumber;
        sets: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StretchDayDto = z.infer<typeof stretchDayDtoSchema>;
export declare const stretchPlanDtoSchema: z.ZodObject<{
    phase: z.ZodEnum<{
        AUFBAU: "AUFBAU";
        MUSKELAUSDAUER: "MUSKELAUSDAUER";
        NEGATIV: "NEGATIV";
        DAILY: "DAILY";
        CUSTOM_1: "CUSTOM_1";
        CUSTOM_2: "CUSTOM_2";
        CUSTOM_3: "CUSTOM_3";
        CUSTOM_4: "CUSTOM_4";
        CUSTOM_5: "CUSTOM_5";
    }>;
    days: z.ZodArray<z.ZodObject<{
        dayLabel: z.ZodNullable<z.ZodString>;
        muscles: z.ZodArray<z.ZodString>;
        source: z.ZodEnum<{
            auto: "auto";
            ai: "ai";
        }>;
        items: z.ZodArray<z.ZodObject<{
            exerciseId: z.ZodString;
            name: z.ZodString;
            description: z.ZodNullable<z.ZodString>;
            imageUrls: z.ZodArray<z.ZodString>;
            primaryMuscles: z.ZodArray<z.ZodString>;
            holdSeconds: z.ZodNumber;
            sets: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    catalogAvailable: z.ZodBoolean;
}, z.core.$strip>;
export type StretchPlanDto = z.infer<typeof stretchPlanDtoSchema>;
export declare const generateStretchPlanRequestSchema: z.ZodObject<{
    phase: z.ZodEnum<{
        AUFBAU: "AUFBAU";
        MUSKELAUSDAUER: "MUSKELAUSDAUER";
        NEGATIV: "NEGATIV";
        DAILY: "DAILY";
        CUSTOM_1: "CUSTOM_1";
        CUSTOM_2: "CUSTOM_2";
        CUSTOM_3: "CUSTOM_3";
        CUSTOM_4: "CUSTOM_4";
        CUSTOM_5: "CUSTOM_5";
    }>;
}, z.core.$strip>;
export type GenerateStretchPlanRequest = z.infer<typeof generateStretchPlanRequestSchema>;
export declare const dailyStretchDtoSchema: z.ZodObject<{
    focus: z.ZodNullable<z.ZodEnum<{
        neck: "neck";
        shoulders: "shoulders";
        chest: "chest";
        biceps: "biceps";
        triceps: "triceps";
        forearms: "forearms";
        lats: "lats";
        "middle back": "middle back";
        "lower back": "lower back";
        traps: "traps";
        abdominals: "abdominals";
        glutes: "glutes";
        abductors: "abductors";
        adductors: "adductors";
        quadriceps: "quadriceps";
        hamstrings: "hamstrings";
        calves: "calves";
    }>>;
    items: z.ZodArray<z.ZodObject<{
        exerciseId: z.ZodString;
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        imageUrls: z.ZodArray<z.ZodString>;
        primaryMuscles: z.ZodArray<z.ZodString>;
        holdSeconds: z.ZodNumber;
        sets: z.ZodNumber;
    }, z.core.$strip>>;
    catalogAvailable: z.ZodBoolean;
}, z.core.$strip>;
export type DailyStretchDto = z.infer<typeof dailyStretchDtoSchema>;
