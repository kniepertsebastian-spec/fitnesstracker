import { z } from "zod";
import { cardioMachineSchema } from "./cardioLog.schema.js";
export declare const TRAINING_GOALS: readonly ["MUSCLE_GAIN", "STRENGTH", "ENDURANCE", "FAT_LOSS", "GENERAL_FITNESS"];
export declare const trainingGoalValueSchema: z.ZodEnum<{
    MUSCLE_GAIN: "MUSCLE_GAIN";
    STRENGTH: "STRENGTH";
    ENDURANCE: "ENDURANCE";
    FAT_LOSS: "FAT_LOSS";
    GENERAL_FITNESS: "GENERAL_FITNESS";
}>;
export type TrainingGoalValue = z.infer<typeof trainingGoalValueSchema>;
export declare const TRAINING_GOAL_LABELS: Record<TrainingGoalValue, string>;
export declare const CARDIO_MACHINE_LABELS: Record<z.infer<typeof cardioMachineSchema>, string>;
export declare const updateTrainingGoalSchema: z.ZodObject<{
    goal: z.ZodNullable<z.ZodEnum<{
        MUSCLE_GAIN: "MUSCLE_GAIN";
        STRENGTH: "STRENGTH";
        ENDURANCE: "ENDURANCE";
        FAT_LOSS: "FAT_LOSS";
        GENERAL_FITNESS: "GENERAL_FITNESS";
    }>>;
}, z.core.$strip>;
export type UpdateTrainingGoalInput = z.infer<typeof updateTrainingGoalSchema>;
export declare const cardioSlotSchema: z.ZodEnum<{
    WARMUP: "WARMUP";
    AFTER: "AFTER";
    FREE: "FREE";
}>;
export type CardioSlot = z.infer<typeof cardioSlotSchema>;
export declare const CARDIO_SLOT_LABELS: Record<CardioSlot, string>;
export declare const cardioPlanItemSchema: z.ZodObject<{
    slot: z.ZodEnum<{
        WARMUP: "WARMUP";
        AFTER: "AFTER";
        FREE: "FREE";
    }>;
    machine: z.ZodEnum<{
        TREADMILL: "TREADMILL";
        BIKE: "BIKE";
        STEPPER: "STEPPER";
        STAIRMASTER: "STAIRMASTER";
    }>;
    durationMinutes: z.ZodNumber;
    intensity: z.ZodString;
}, z.core.$strip>;
export type CardioPlanItem = z.infer<typeof cardioPlanItemSchema>;
export declare const cardioPlanDayDtoSchema: z.ZodObject<{
    dayLabel: z.ZodNullable<z.ZodString>;
    isLegDay: z.ZodBoolean;
    source: z.ZodEnum<{
        custom: "custom";
        auto: "auto";
    }>;
    items: z.ZodArray<z.ZodObject<{
        slot: z.ZodEnum<{
            WARMUP: "WARMUP";
            AFTER: "AFTER";
            FREE: "FREE";
        }>;
        machine: z.ZodEnum<{
            TREADMILL: "TREADMILL";
            BIKE: "BIKE";
            STEPPER: "STEPPER";
            STAIRMASTER: "STAIRMASTER";
        }>;
        durationMinutes: z.ZodNumber;
        intensity: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CardioPlanDayDto = z.infer<typeof cardioPlanDayDtoSchema>;
export declare const cardioPlanDtoSchema: z.ZodObject<{
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
    goal: z.ZodNullable<z.ZodEnum<{
        MUSCLE_GAIN: "MUSCLE_GAIN";
        STRENGTH: "STRENGTH";
        ENDURANCE: "ENDURANCE";
        FAT_LOSS: "FAT_LOSS";
        GENERAL_FITNESS: "GENERAL_FITNESS";
    }>>;
    reason: z.ZodString;
    days: z.ZodArray<z.ZodObject<{
        dayLabel: z.ZodNullable<z.ZodString>;
        isLegDay: z.ZodBoolean;
        source: z.ZodEnum<{
            custom: "custom";
            auto: "auto";
        }>;
        items: z.ZodArray<z.ZodObject<{
            slot: z.ZodEnum<{
                WARMUP: "WARMUP";
                AFTER: "AFTER";
                FREE: "FREE";
            }>;
            machine: z.ZodEnum<{
                TREADMILL: "TREADMILL";
                BIKE: "BIKE";
                STEPPER: "STEPPER";
                STAIRMASTER: "STAIRMASTER";
            }>;
            durationMinutes: z.ZodNumber;
            intensity: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    free: z.ZodObject<{
        source: z.ZodEnum<{
            custom: "custom";
            auto: "auto";
        }>;
        items: z.ZodArray<z.ZodObject<{
            slot: z.ZodEnum<{
                WARMUP: "WARMUP";
                AFTER: "AFTER";
                FREE: "FREE";
            }>;
            machine: z.ZodEnum<{
                TREADMILL: "TREADMILL";
                BIKE: "BIKE";
                STEPPER: "STEPPER";
                STAIRMASTER: "STAIRMASTER";
            }>;
            durationMinutes: z.ZodNumber;
            intensity: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type CardioPlanDto = z.infer<typeof cardioPlanDtoSchema>;
export declare const saveCardioPlanDaySchema: z.ZodObject<{
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
    dayLabel: z.ZodNullable<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        machine: z.ZodEnum<{
            TREADMILL: "TREADMILL";
            BIKE: "BIKE";
            STEPPER: "STEPPER";
            STAIRMASTER: "STAIRMASTER";
        }>;
        durationMinutes: z.ZodNumber;
        intensity: z.ZodString;
        slot: z.ZodEnum<{
            WARMUP: "WARMUP";
            AFTER: "AFTER";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SaveCardioPlanDayInput = z.infer<typeof saveCardioPlanDaySchema>;
export declare const saveCardioPlanFreeSchema: z.ZodObject<{
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
    items: z.ZodArray<z.ZodObject<{
        machine: z.ZodEnum<{
            TREADMILL: "TREADMILL";
            BIKE: "BIKE";
            STEPPER: "STEPPER";
            STAIRMASTER: "STAIRMASTER";
        }>;
        durationMinutes: z.ZodNumber;
        intensity: z.ZodString;
        slot: z.ZodLiteral<"FREE">;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SaveCardioPlanFreeInput = z.infer<typeof saveCardioPlanFreeSchema>;
export declare const resetCardioPlanSchema: z.ZodObject<{
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
    dayLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    scope: z.ZodEnum<{
        day: "day";
        free: "free";
    }>;
}, z.core.$strip>;
export type ResetCardioPlanInput = z.infer<typeof resetCardioPlanSchema>;
