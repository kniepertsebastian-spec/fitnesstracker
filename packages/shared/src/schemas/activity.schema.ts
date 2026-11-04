import { z } from "zod";
import { cardioMachineSchema, dataSourceSchema } from "./cardioLog.schema.js";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

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
