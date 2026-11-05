import { z } from "zod";

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

// --- Weekly activity report -------------------------------------------------------------------

export const activityReportQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(8),
  // IANA name of the viewer's time zone (days are cut at local midnight). Defaults on the server.
  tz: z.string().min(1).max(64).optional(),
});
export type ActivityReportQuery = z.infer<typeof activityReportQuerySchema>;

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
