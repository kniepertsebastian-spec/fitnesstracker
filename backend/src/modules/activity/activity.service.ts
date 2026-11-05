import type { PrismaClient } from "@prisma/client";
import type { ActivityReport } from "@fitnesstracker/shared";
import { addDays, composeActivityReport, DEFAULT_TIME_ZONE, isValidTimeZone, reportRange } from "./activityReport.js";

export function resolveTimeZone(requested: string | undefined): string {
  return requested && isValidTimeZone(requested) ? requested : DEFAULT_TIME_ZONE;
}

// Reads the rows of the last `weeks` weeks and hands them to the pure composer. Rows are fetched
// with a day of slack on both sides because the week borders are cut at local midnight, which can
// be up to 14 hours away from UTC midnight.
export async function loadActivityReport(
  prisma: PrismaClient,
  userId: string,
  options: { weeks: number; timeZone?: string; now?: Date },
): Promise<ActivityReport> {
  const timeZone = resolveTimeZone(options.timeZone);
  const now = options.now ?? new Date();
  const { firstMonday, lastSunday } = reportRange(options.weeks, timeZone, now);
  const from = new Date(`${addDays(firstMonday, -1)}T00:00:00.000Z`);
  const until = new Date(`${addDays(lastSunday, 2)}T00:00:00.000Z`);

  const [sets, studioBike, days, rides] = await Promise.all([
    prisma.workoutLog.findMany({
      where: { userId, deletedAt: null, performedAt: { gte: from, lt: until } },
      select: { performedAt: true, reps: true, weightKg: true, rir: true, exercise: { select: { primaryMuscles: true } } },
    }),
    prisma.cardioLog.findMany({
      where: { userId, deletedAt: null, machine: "BIKE", performedAt: { gte: from, lt: until } },
      select: { performedAt: true, durationMinutes: true },
    }),
    prisma.dailyActivity.findMany({
      where: { userId, date: { gte: new Date(`${firstMonday}T00:00:00.000Z`), lte: new Date(`${lastSunday}T00:00:00.000Z`) } },
      select: { date: true, steps: true, distanceMeters: true },
    }),
    prisma.cyclingSession.findMany({
      where: { userId, startedAt: { gte: from, lt: until } },
      select: { startedAt: true, durationSeconds: true, distanceMeters: true },
    }),
  ]);

  return composeActivityReport(
    {
      workoutSets: sets.map((s) => ({
        performedAt: s.performedAt,
        reps: s.reps,
        weightKg: Number(s.weightKg),
        rir: s.rir,
        primaryMuscles: s.exercise.primaryMuscles,
      })),
      studioBike,
      days: days.map((d) => ({ date: d.date.toISOString().slice(0, 10), steps: d.steps, distanceMeters: d.distanceMeters })),
      rides,
    },
    { weeks: options.weeks, timeZone, now },
  );
}
