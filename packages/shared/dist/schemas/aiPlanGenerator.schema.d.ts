import { z } from "zod";
export declare const AI_PROVIDERS: readonly ["GEMINI", "OPENAI", "GROQ", "OPENROUTER"];
export declare const aiProviderSchema: z.ZodEnum<{
    GEMINI: "GEMINI";
    OPENAI: "OPENAI";
    GROQ: "GROQ";
    OPENROUTER: "OPENROUTER";
}>;
export type AiProvider = z.infer<typeof aiProviderSchema>;
export declare const aiSettingsDtoSchema: z.ZodObject<{
    provider: z.ZodNullable<z.ZodEnum<{
        GEMINI: "GEMINI";
        OPENAI: "OPENAI";
        GROQ: "GROQ";
        OPENROUTER: "OPENROUTER";
    }>>;
    hasApiKey: z.ZodBoolean;
    model: z.ZodNullable<z.ZodString>;
    configured: z.ZodBoolean;
}, z.core.$strip>;
export type AiSettingsDto = z.infer<typeof aiSettingsDtoSchema>;
export declare const saveAiSettingsSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        GEMINI: "GEMINI";
        OPENAI: "OPENAI";
        GROQ: "GROQ";
        OPENROUTER: "OPENROUTER";
    }>;
    apiKey: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SaveAiSettingsInput = z.infer<typeof saveAiSettingsSchema>;
export declare const EQUIPMENT_TAGS: readonly ["machine", "dumbbell", "barbell", "cable", "body only", "kettlebells", "bands", "medicine ball", "exercise ball", "foam roll", "other"];
export declare const equipmentTagSchema: z.ZodEnum<{
    machine: "machine";
    dumbbell: "dumbbell";
    barbell: "barbell";
    cable: "cable";
    "body only": "body only";
    kettlebells: "kettlebells";
    bands: "bands";
    "medicine ball": "medicine ball";
    "exercise ball": "exercise ball";
    "foam roll": "foam roll";
    other: "other";
}>;
export type EquipmentTag = z.infer<typeof equipmentTagSchema>;
export declare const DEFAULT_EQUIPMENT: EquipmentTag[];
export declare const SPLIT_PREFERENCES: readonly ["auto", "full_body", "upper_lower", "push_pull_legs", "bro_split", "custom"];
export declare const splitPreferenceSchema: z.ZodEnum<{
    custom: "custom";
    auto: "auto";
    full_body: "full_body";
    upper_lower: "upper_lower";
    push_pull_legs: "push_pull_legs";
    bro_split: "bro_split";
}>;
export type SplitPreference = z.infer<typeof splitPreferenceSchema>;
export declare const coldStartExperienceSchema: z.ZodEnum<{
    beginner: "beginner";
    intermediate: "intermediate";
    advanced: "advanced";
}>;
export declare const trainingGoalSchema: z.ZodEnum<{
    muscle_gain: "muscle_gain";
    strength: "strength";
    endurance: "endurance";
    fat_loss: "fat_loss";
    general_fitness: "general_fitness";
}>;
export declare const coldStartInputSchema: z.ZodObject<{
    frequencyPerWeek: z.ZodNumber;
    split: z.ZodDefault<z.ZodEnum<{
        custom: "custom";
        auto: "auto";
        full_body: "full_body";
        upper_lower: "upper_lower";
        push_pull_legs: "push_pull_legs";
        bro_split: "bro_split";
    }>>;
    customSplit: z.ZodOptional<z.ZodString>;
    equipment: z.ZodArray<z.ZodEnum<{
        machine: "machine";
        dumbbell: "dumbbell";
        barbell: "barbell";
        cable: "cable";
        "body only": "body only";
        kettlebells: "kettlebells";
        bands: "bands";
        "medicine ball": "medicine ball";
        "exercise ball": "exercise ball";
        "foam roll": "foam roll";
        other: "other";
    }>>;
    experience: z.ZodEnum<{
        beginner: "beginner";
        intermediate: "intermediate";
        advanced: "advanced";
    }>;
    goal: z.ZodEnum<{
        muscle_gain: "muscle_gain";
        strength: "strength";
        endurance: "endurance";
        fat_loss: "fat_loss";
        general_fitness: "general_fitness";
    }>;
    sessionDurationMinutes: z.ZodNumber;
    equipmentDetails: z.ZodOptional<z.ZodString>;
    priorityMuscles: z.ZodOptional<z.ZodString>;
    preferredExercises: z.ZodOptional<z.ZodString>;
    avoidedExercises: z.ZodOptional<z.ZodString>;
    limitations: z.ZodOptional<z.ZodString>;
    includeCardio: z.ZodDefault<z.ZodBoolean>;
    includeStretching: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type ColdStartInput = z.infer<typeof coldStartInputSchema>;
export type ColdStartInputPayload = z.input<typeof coldStartInputSchema>;
export declare const generatePlanRequestSchema: z.ZodObject<{
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
    coldStart: z.ZodOptional<z.ZodObject<{
        frequencyPerWeek: z.ZodNumber;
        split: z.ZodDefault<z.ZodEnum<{
            custom: "custom";
            auto: "auto";
            full_body: "full_body";
            upper_lower: "upper_lower";
            push_pull_legs: "push_pull_legs";
            bro_split: "bro_split";
        }>>;
        customSplit: z.ZodOptional<z.ZodString>;
        equipment: z.ZodArray<z.ZodEnum<{
            machine: "machine";
            dumbbell: "dumbbell";
            barbell: "barbell";
            cable: "cable";
            "body only": "body only";
            kettlebells: "kettlebells";
            bands: "bands";
            "medicine ball": "medicine ball";
            "exercise ball": "exercise ball";
            "foam roll": "foam roll";
            other: "other";
        }>>;
        experience: z.ZodEnum<{
            beginner: "beginner";
            intermediate: "intermediate";
            advanced: "advanced";
        }>;
        goal: z.ZodEnum<{
            muscle_gain: "muscle_gain";
            strength: "strength";
            endurance: "endurance";
            fat_loss: "fat_loss";
            general_fitness: "general_fitness";
        }>;
        sessionDurationMinutes: z.ZodNumber;
        equipmentDetails: z.ZodOptional<z.ZodString>;
        priorityMuscles: z.ZodOptional<z.ZodString>;
        preferredExercises: z.ZodOptional<z.ZodString>;
        avoidedExercises: z.ZodOptional<z.ZodString>;
        limitations: z.ZodOptional<z.ZodString>;
        includeCardio: z.ZodDefault<z.ZodBoolean>;
        includeStretching: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    day: z.ZodOptional<z.ZodString>;
    allPhases: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type GeneratePlanRequest = z.input<typeof generatePlanRequestSchema>;
export declare const planDraftItemSchema: z.ZodObject<{
    day: z.ZodNullable<z.ZodString>;
    exerciseId: z.ZodString;
    exerciseName: z.ZodString;
    equipment: z.ZodNullable<z.ZodString>;
    primaryMuscles: z.ZodArray<z.ZodString>;
    targetSets: z.ZodNullable<z.ZodNumber>;
    targetReps: z.ZodNullable<z.ZodNumber>;
    repRangeMin: z.ZodNullable<z.ZodNumber>;
    repRangeMax: z.ZodNullable<z.ZodNumber>;
    targetRir: z.ZodNullable<z.ZodNumber>;
    restSeconds: z.ZodNullable<z.ZodNumber>;
    notes: z.ZodNullable<z.ZodString>;
    startWeightKg: z.ZodNullable<z.ZodNumber>;
    alternativeExerciseId: z.ZodNullable<z.ZodString>;
    alternativeExerciseName: z.ZodNullable<z.ZodString>;
    filledByServer: z.ZodBoolean;
}, z.core.$strip>;
export type PlanDraftItemDto = z.infer<typeof planDraftItemSchema>;
export declare const planDraftDtoSchema: z.ZodObject<{
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
    days: z.ZodArray<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        day: z.ZodNullable<z.ZodString>;
        exerciseId: z.ZodString;
        exerciseName: z.ZodString;
        equipment: z.ZodNullable<z.ZodString>;
        primaryMuscles: z.ZodArray<z.ZodString>;
        targetSets: z.ZodNullable<z.ZodNumber>;
        targetReps: z.ZodNullable<z.ZodNumber>;
        repRangeMin: z.ZodNullable<z.ZodNumber>;
        repRangeMax: z.ZodNullable<z.ZodNumber>;
        targetRir: z.ZodNullable<z.ZodNumber>;
        restSeconds: z.ZodNullable<z.ZodNumber>;
        notes: z.ZodNullable<z.ZodString>;
        startWeightKg: z.ZodNullable<z.ZodNumber>;
        alternativeExerciseId: z.ZodNullable<z.ZodString>;
        alternativeExerciseName: z.ZodNullable<z.ZodString>;
        filledByServer: z.ZodBoolean;
    }, z.core.$strip>>;
    rationale: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type PlanDraftDto = z.infer<typeof planDraftDtoSchema>;
export declare const planDraftStateDtoSchema: z.ZodObject<{
    draft: z.ZodNullable<z.ZodObject<{
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
        days: z.ZodArray<z.ZodString>;
        items: z.ZodArray<z.ZodObject<{
            day: z.ZodNullable<z.ZodString>;
            exerciseId: z.ZodString;
            exerciseName: z.ZodString;
            equipment: z.ZodNullable<z.ZodString>;
            primaryMuscles: z.ZodArray<z.ZodString>;
            targetSets: z.ZodNullable<z.ZodNumber>;
            targetReps: z.ZodNullable<z.ZodNumber>;
            repRangeMin: z.ZodNullable<z.ZodNumber>;
            repRangeMax: z.ZodNullable<z.ZodNumber>;
            targetRir: z.ZodNullable<z.ZodNumber>;
            restSeconds: z.ZodNullable<z.ZodNumber>;
            notes: z.ZodNullable<z.ZodString>;
            startWeightKg: z.ZodNullable<z.ZodNumber>;
            alternativeExerciseId: z.ZodNullable<z.ZodString>;
            alternativeExerciseName: z.ZodNullable<z.ZodString>;
            filledByServer: z.ZodBoolean;
        }, z.core.$strip>>;
        rationale: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    hasBackup: z.ZodBoolean;
}, z.core.$strip>;
export type PlanDraftStateDto = z.infer<typeof planDraftStateDtoSchema>;
export declare const planPhaseRequestSchema: z.ZodObject<{
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
export declare const generatePlanResponseSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    status: z.ZodLiteral<"needs_cold_start">;
}, z.core.$strip>, z.ZodObject<{
    status: z.ZodLiteral<"draft">;
    draft: z.ZodObject<{
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
        days: z.ZodArray<z.ZodString>;
        items: z.ZodArray<z.ZodObject<{
            day: z.ZodNullable<z.ZodString>;
            exerciseId: z.ZodString;
            exerciseName: z.ZodString;
            equipment: z.ZodNullable<z.ZodString>;
            primaryMuscles: z.ZodArray<z.ZodString>;
            targetSets: z.ZodNullable<z.ZodNumber>;
            targetReps: z.ZodNullable<z.ZodNumber>;
            repRangeMin: z.ZodNullable<z.ZodNumber>;
            repRangeMax: z.ZodNullable<z.ZodNumber>;
            targetRir: z.ZodNullable<z.ZodNumber>;
            restSeconds: z.ZodNullable<z.ZodNumber>;
            notes: z.ZodNullable<z.ZodString>;
            startWeightKg: z.ZodNullable<z.ZodNumber>;
            alternativeExerciseId: z.ZodNullable<z.ZodString>;
            alternativeExerciseName: z.ZodNullable<z.ZodString>;
            filledByServer: z.ZodBoolean;
        }, z.core.$strip>>;
        rationale: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>;
    otherDrafts: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
        days: z.ZodArray<z.ZodString>;
        items: z.ZodArray<z.ZodObject<{
            day: z.ZodNullable<z.ZodString>;
            exerciseId: z.ZodString;
            exerciseName: z.ZodString;
            equipment: z.ZodNullable<z.ZodString>;
            primaryMuscles: z.ZodArray<z.ZodString>;
            targetSets: z.ZodNullable<z.ZodNumber>;
            targetReps: z.ZodNullable<z.ZodNumber>;
            repRangeMin: z.ZodNullable<z.ZodNumber>;
            repRangeMax: z.ZodNullable<z.ZodNumber>;
            targetRir: z.ZodNullable<z.ZodNumber>;
            restSeconds: z.ZodNullable<z.ZodNumber>;
            notes: z.ZodNullable<z.ZodString>;
            startWeightKg: z.ZodNullable<z.ZodNumber>;
            alternativeExerciseId: z.ZodNullable<z.ZodString>;
            alternativeExerciseName: z.ZodNullable<z.ZodString>;
            filledByServer: z.ZodBoolean;
        }, z.core.$strip>>;
        rationale: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>>>;
    replacedPlateaus: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>], "status">;
export type GeneratePlanResponse = z.infer<typeof generatePlanResponseSchema>;
