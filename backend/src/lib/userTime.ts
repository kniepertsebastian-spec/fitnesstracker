import type { PrismaClient } from "@prisma/client";
import { DEFAULT_TIME_ZONE, isValidTimeZone, localDate } from "../modules/activity/activityReport.js";
import { localTimeToUtc } from "../modules/bodyComposition/scaleReport.parser.js";

// "Today", "this week" and the evening reminders belong to the account's wall clock, not to UTC:
// a challenge must switch at midnight where the user lives, and Monday 00:30 local time is
// still Sunday in UTC. The zone is stored on the account (User.timeZone, from the browser).

export { DEFAULT_TIME_ZONE };

export function resolveUserTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

export async function getUserTimeZone(prisma: PrismaClient, userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  return resolveUserTimeZone(user?.timeZone);
}

function dayParts(instant: Date, timeZone: string) {
  const [year, month, day] = localDate(instant, timeZone).split("-").map(Number) as [number, number, number];
  return { year, month, day };
}

/** "2026-11-09": the calendar day of the instant in the zone. */
export function localDayKey(instant: Date, timeZone: string): string {
  return localDate(instant, timeZone);
}

/** The instant at which the zone's calendar day of `instant` began (local 00:00). */
export function localDayStart(instant: Date, timeZone: string): Date {
  const { year, month, day } = dayParts(instant, timeZone);
  return localTimeToUtc(year, month, day, 0, 0, 0, timeZone);
}

/** The instant at which the zone's week (Monday 00:00 local) of `instant` began. */
export function localWeekStart(instant: Date, timeZone: string): Date {
  const { year, month, day } = dayParts(instant, timeZone);
  const sinceMonday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return localTimeToUtc(year, month, day - sinceMonday, 0, 0, 0, timeZone);
}

/**
 * The zone's calendar day as UTC midnight — the representation of `@db.Date` columns, which
 * store a bare date (e.g. DailyChallengeItem.date, the "reminder sent on" markers).
 */
export function localDateAsUtc(instant: Date, timeZone: string): Date {
  const { year, month, day } = dayParts(instant, timeZone);
  return new Date(Date.UTC(year, month - 1, day));
}

/** The Monday of the zone's week as a bare date (UTC midnight), for `@db.Date` columns. */
export function localWeekStartAsUtc(instant: Date, timeZone: string): Date {
  const day = localDateAsUtc(instant, timeZone);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}

/** Hour of day (0–23) in the zone. */
export function localHour(instant: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(instant);
  return Number(hour);
}
