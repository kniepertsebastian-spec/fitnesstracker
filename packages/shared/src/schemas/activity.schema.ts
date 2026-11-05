import { z } from "zod";
import { cardioMachineSchema, dataSourceSchema } from "./cardioLog.schema.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

// --- Health Connect sync (Android companion app -> webhook) -------------------------------------

export interface HealthSyncStatusDto {
  // A token exists, i.e. the companion app can be pointed at the webhook.
  connected: boolean;
  tokenCreatedAt: string | null;
  // Last time the webhook accepted a request with this token.
  lastUsedAt: string | null;
  daysStored: number;
  firstDay: string | null;
  lastDay: string | null;
  ridesStored: number;
}

// The plaintext token is returned exactly once, when it is created.
export interface HealthSyncTokenCreatedDto {
  token: string;
  status: HealthSyncStatusDto;
}

// --- Insurance activity report (date range based) ---

// Days the report may span at most — keeps the response small and the "Nachweis" meaningful.
export const MAX_REPORT_DAYS = 92;
export const DEFAULT_REPORT_DAYS = 28;

export const activityReportQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});
export type ActivityReportQuery = z.infer<typeof activityReportQuerySchema>;

export const activityDayDtoSchema = z.object({
  date: dateOnly,
  steps: z.number().int(),
  distanceKm: z.number(),
  source: dataSourceSchema,
});
export type ActivityDayDto = z.infer<typeof activityDayDtoSchema>;

export const activityCycleSessionDtoSchema = z.object({
  performedAt: z.string().datetime(),
  machine: cardioMachineSchema,
  durationMinutes: z.number().int(),
  distanceKm: z.number().nullable(),
  source: dataSourceSchema,
});
export type ActivityCycleSessionDto = z.infer<typeof activityCycleSessionDtoSchema>;

export const activityReportDtoSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string(),
  from: dateOnly,
  to: dateOnly,
  generatedAt: z.string().datetime(),
  days: z.array(activityDayDtoSchema),
  // Bike sessions only (machine BIKE) — that is what the insurer asks for.
  bikeSessions: z.array(activityCycleSessionDtoSchema),
  totals: z.object({
    steps: z.number().int(),
    stepsDistanceKm: z.number(),
    daysWithSteps: z.number().int(),
    bikeSessions: z.number().int(),
    bikeKm: z.number(),
    bikeMinutes: z.number().int(),
    // Share of the totals that came from a device or an export file rather than being typed in.
    manualBikeSessions: z.number().int(),
  }),
});
export type ActivityReportDto = z.infer<typeof activityReportDtoSchema>;

// Bulk import of daily steps/distance read from a health-app export.
export const importActivityDaysSchema = z.object({
  days: z
    .array(
      z.object({
        date: dateOnly,
        steps: z.number().int().min(0).max(200000),
        distanceKm: z.number().min(0).max(500),
      }),
    )
    .min(1)
    .max(1000),
});
export type ImportActivityDaysInput = z.infer<typeof importActivityDaysSchema>;

export interface ImportActivityDaysResult {
  imported: number;
  updated: number;
}

// --- Weekly comprehensive activity report (for exports with strength) ---

export const activityWeeklyReportQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(8),
  // IANA name of the viewer's time zone (days are cut at local midnight). Defaults on the server.
  tz: z.string().min(1).max(64).optional(),
});
export type ActivityWeeklyReportQuery = z.infer<typeof activityWeeklyReportQuerySchema>;

export interface ActivityStrengthWeek {
  trainingDays: number;
  sets: number;
  reps: number;
  // Sum of reps x weight over all sets (bodyweight sets with 0 kg add nothing).
  volumeKg: number;
  // Mean reps in reserve over the sets that have one; null when no set has one.
  averageRir: number | null;
  // Sets per primary muscle of the exercise.
  setsByMuscle: Record<string, number>;
}

export interface ActivityStepsWeek {
  total: number;
  daysWithData: number;
  // total / daysWithData; null without data.
  averagePerDay: number | null;
  days: { date: string; steps: number | null }[];
}

export interface ActivityCyclingWeek {
  totalMinutes: number;
  // null when no ride of the week has a distance (studio bike has none).
  totalKm: number | null;
  rides: number;
  // total / days of the week that count (7, or the elapsed days in the running week).
  averageMinutesPerDay: number;
  averageKmPerDay: number | null;
  days: { date: string; minutes: number; km: number | null }[];
}

export interface ActivityWeek {
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string; // Sunday, YYYY-MM-DD
  isoWeek: string; // "2026-W44"
  // The running week: only the days up to today count.
  partial: boolean;
  daysCounted: number;
  strength: ActivityStrengthWeek;
  steps: ActivityStepsWeek;
  cyclingOutdoor: ActivityCyclingWeek;
  cyclingStudio: ActivityCyclingWeek;
}

// Shaped like a health-app export (type / unit / start / end / value), but with this app's own type
// names and a summary per week next to it.
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
  range: { from: string; to: string };
  totals: {
    steps: { total: number; daysWithData: number; averagePerDay: number | null };
    cyclingOutdoor: { minutes: number; km: number | null; rides: number };
    cyclingStudio: { minutes: number; sessions: number };
    strength: { trainingDays: number; sets: number; volumeKg: number };
  };
  weeks: ActivityWeek[];
  records: ActivityRecord[];
}
