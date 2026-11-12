import { z } from "zod";
export interface HealthSyncStatusDto {
    connected: boolean;
    tokenCreatedAt: string | null;
    lastUsedAt: string | null;
    daysStored: number;
    firstDay: string | null;
    lastDay: string | null;
    ridesStored: number;
}
export interface HealthSyncTokenCreatedDto {
    token: string;
    status: HealthSyncStatusDto;
}
export declare const MAX_REPORT_DAYS = 92;
export declare const DEFAULT_REPORT_DAYS = 28;
export declare const activityReportQuerySchema: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ActivityReportQuery = z.infer<typeof activityReportQuerySchema>;
export declare const activityDayDtoSchema: z.ZodObject<{
    date: z.ZodString;
    steps: z.ZodNumber;
    distanceKm: z.ZodNumber;
    source: z.ZodEnum<{
        MANUAL: "MANUAL";
        IMPORT: "IMPORT";
        FITBIT: "FITBIT";
    }>;
}, z.core.$strip>;
export type ActivityDayDto = z.infer<typeof activityDayDtoSchema>;
export declare const activityCycleSessionDtoSchema: z.ZodObject<{
    performedAt: z.ZodString;
    machine: z.ZodEnum<{
        TREADMILL: "TREADMILL";
        BIKE: "BIKE";
        STEPPER: "STEPPER";
        STAIRMASTER: "STAIRMASTER";
    }>;
    durationMinutes: z.ZodNumber;
    distanceKm: z.ZodNullable<z.ZodNumber>;
    source: z.ZodEnum<{
        MANUAL: "MANUAL";
        IMPORT: "IMPORT";
        FITBIT: "FITBIT";
    }>;
}, z.core.$strip>;
export type ActivityCycleSessionDto = z.infer<typeof activityCycleSessionDtoSchema>;
export declare const activityReportDtoSchema: z.ZodObject<{
    firstName: z.ZodNullable<z.ZodString>;
    lastName: z.ZodNullable<z.ZodString>;
    email: z.ZodString;
    from: z.ZodString;
    to: z.ZodString;
    generatedAt: z.ZodString;
    days: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        steps: z.ZodNumber;
        distanceKm: z.ZodNumber;
        source: z.ZodEnum<{
            MANUAL: "MANUAL";
            IMPORT: "IMPORT";
            FITBIT: "FITBIT";
        }>;
    }, z.core.$strip>>;
    bikeSessions: z.ZodArray<z.ZodObject<{
        performedAt: z.ZodString;
        machine: z.ZodEnum<{
            TREADMILL: "TREADMILL";
            BIKE: "BIKE";
            STEPPER: "STEPPER";
            STAIRMASTER: "STAIRMASTER";
        }>;
        durationMinutes: z.ZodNumber;
        distanceKm: z.ZodNullable<z.ZodNumber>;
        source: z.ZodEnum<{
            MANUAL: "MANUAL";
            IMPORT: "IMPORT";
            FITBIT: "FITBIT";
        }>;
    }, z.core.$strip>>;
    totals: z.ZodObject<{
        steps: z.ZodNumber;
        stepsDistanceKm: z.ZodNumber;
        daysWithSteps: z.ZodNumber;
        bikeSessions: z.ZodNumber;
        bikeKm: z.ZodNumber;
        bikeMinutes: z.ZodNumber;
        manualBikeSessions: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ActivityReportDto = z.infer<typeof activityReportDtoSchema>;
export declare const importActivityDaysSchema: z.ZodObject<{
    days: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        steps: z.ZodNumber;
        distanceKm: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ImportActivityDaysInput = z.infer<typeof importActivityDaysSchema>;
export interface ImportActivityDaysResult {
    imported: number;
    updated: number;
}
export declare const activityWeeklyReportQuerySchema: z.ZodObject<{
    weeks: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    tz: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ActivityWeeklyReportQuery = z.infer<typeof activityWeeklyReportQuerySchema>;
export interface ActivityStrengthWeek {
    trainingDays: number;
    sets: number;
    reps: number;
    volumeKg: number;
    averageRir: number | null;
    setsByMuscle: Record<string, number>;
}
export interface ActivityStepsWeek {
    total: number;
    daysWithData: number;
    averagePerDay: number | null;
    days: {
        date: string;
        steps: number | null;
    }[];
}
export interface ActivityCyclingWeek {
    totalMinutes: number;
    totalKm: number | null;
    rides: number;
    averageMinutesPerDay: number;
    averageKmPerDay: number | null;
    days: {
        date: string;
        minutes: number;
        km: number | null;
    }[];
}
export interface ActivityWeek {
    weekStart: string;
    weekEnd: string;
    isoWeek: string;
    partial: boolean;
    daysCounted: number;
    strength: ActivityStrengthWeek;
    steps: ActivityStepsWeek;
    cyclingOutdoor: ActivityCyclingWeek;
    cyclingStudio: ActivityCyclingWeek;
}
export interface ActivityRecord {
    type: string;
    unit: string;
    startDate: string;
    endDate: string;
    value: number;
    sourceName: string;
}
export interface ActivityReport {
    format: "fitnesstracker-activity";
    version: 1;
    generatedAt: string;
    timeZone: string;
    range: {
        from: string;
        to: string;
    };
    totals: {
        steps: {
            total: number;
            daysWithData: number;
            averagePerDay: number | null;
        };
        cyclingOutdoor: {
            minutes: number;
            km: number | null;
            rides: number;
        };
        cyclingStudio: {
            minutes: number;
            sessions: number;
        };
        strength: {
            trainingDays: number;
            sets: number;
            volumeKg: number;
        };
    };
    weeks: ActivityWeek[];
    records: ActivityRecord[];
}
