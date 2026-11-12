import { z } from "zod";
export declare const trainingPhaseSchema: z.ZodEnum<{
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
export declare const phaseConfigItemSchema: z.ZodObject<{
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
    label: z.ZodString;
    isDaily: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type PhaseConfigItem = z.infer<typeof phaseConfigItemSchema>;
export declare const changeTrainingPhaseSchema: z.ZodObject<{
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
export type ChangeTrainingPhaseInput = z.infer<typeof changeTrainingPhaseSchema>;
export declare const addTrainingPhaseSchema: z.ZodObject<{
    label: z.ZodString;
    isDaily: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export type AddTrainingPhaseInput = z.infer<typeof addTrainingPhaseSchema>;
export declare const renameTrainingPhaseSchema: z.ZodObject<{
    label: z.ZodString;
}, z.core.$strip>;
export type RenameTrainingPhaseInput = z.infer<typeof renameTrainingPhaseSchema>;
export declare const trainingPlanPhaseHistoryDtoSchema: z.ZodObject<{
    id: z.ZodString;
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
    startedOn: z.ZodString;
    endedOn: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type TrainingPlanPhaseHistoryDto = z.infer<typeof trainingPlanPhaseHistoryDtoSchema>;
export declare const trainingPlanDtoSchema: z.ZodObject<{
    currentPhase: z.ZodEnum<{
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
    phaseStartedOn: z.ZodString;
    nextRotationOn: z.ZodNullable<z.ZodString>;
    pausedAt: z.ZodNullable<z.ZodString>;
    extensionWeeks: z.ZodNumber;
    trainingGoal: z.ZodNullable<z.ZodEnum<{
        MUSCLE_GAIN: "MUSCLE_GAIN";
        STRENGTH: "STRENGTH";
        ENDURANCE: "ENDURANCE";
        FAT_LOSS: "FAT_LOSS";
        GENERAL_FITNESS: "GENERAL_FITNESS";
    }>>;
    remarks: z.ZodNullable<z.ZodString>;
    detectedAsymmetries: z.ZodArray<z.ZodString>;
    asymmetryAnalyzedAt: z.ZodNullable<z.ZodString>;
    phases: z.ZodArray<z.ZodObject<{
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
        label: z.ZodString;
        isDaily: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    history: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
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
        startedOn: z.ZodString;
        endedOn: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TrainingPlanDto = z.infer<typeof trainingPlanDtoSchema>;
export declare const updateTrainingPlanRemarksSchema: z.ZodObject<{
    remarks: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type UpdateTrainingPlanRemarksInput = z.infer<typeof updateTrainingPlanRemarksSchema>;
