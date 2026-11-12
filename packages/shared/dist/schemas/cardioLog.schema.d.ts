import { z } from "zod";
export declare const dataSourceSchema: z.ZodEnum<{
    MANUAL: "MANUAL";
    IMPORT: "IMPORT";
    FITBIT: "FITBIT";
}>;
export type DataSource = z.infer<typeof dataSourceSchema>;
export declare const DATA_SOURCE_LABELS: Record<DataSource, string>;
export declare const cardioMachineSchema: z.ZodEnum<{
    TREADMILL: "TREADMILL";
    BIKE: "BIKE";
    STEPPER: "STEPPER";
    STAIRMASTER: "STAIRMASTER";
}>;
export type CardioMachine = z.infer<typeof cardioMachineSchema>;
export declare const createCardioLogSchema: z.ZodObject<{
    clientId: z.ZodOptional<z.ZodString>;
    performedAt: z.ZodOptional<z.ZodString>;
    machine: z.ZodEnum<{
        TREADMILL: "TREADMILL";
        BIKE: "BIKE";
        STEPPER: "STEPPER";
        STAIRMASTER: "STAIRMASTER";
    }>;
    level: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    intensity: z.ZodString;
    durationMinutes: z.ZodNumber;
    distanceKm: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
export type CreateCardioLogInput = z.infer<typeof createCardioLogSchema>;
export declare const cardioLogDtoSchema: z.ZodObject<{
    id: z.ZodString;
    clientId: z.ZodNullable<z.ZodString>;
    machine: z.ZodEnum<{
        TREADMILL: "TREADMILL";
        BIKE: "BIKE";
        STEPPER: "STEPPER";
        STAIRMASTER: "STAIRMASTER";
    }>;
    level: z.ZodNullable<z.ZodNumber>;
    intensity: z.ZodString;
    durationMinutes: z.ZodNumber;
    distanceKm: z.ZodNullable<z.ZodNumber>;
    source: z.ZodEnum<{
        MANUAL: "MANUAL";
        IMPORT: "IMPORT";
        FITBIT: "FITBIT";
    }>;
    performedAt: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type CardioLogDto = z.infer<typeof cardioLogDtoSchema>;
