import type { LocalWorkoutLog } from "../offline/db";
import { utcDayKey } from "./dates";

const DAY_MS = 24 * 60 * 60 * 1000;

export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

export function logVolume(log: Pick<LocalWorkoutLog, "weightKg" | "reps">): number {
  return log.weightKg * log.reps;
}

export function dayKeyOf(log: Pick<LocalWorkoutLog, "performedAt">): string {
  return utcDayKey(new Date(log.performedAt));
}

export function volumeByDay(logs: LocalWorkoutLog[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of logs) map.set(dayKeyOf(log), (map.get(dayKeyOf(log)) ?? 0) + logVolume(log));
  return map;
}

// Distinct trained days within [from, to).
export function trainedDaysBetween(logs: LocalWorkoutLog[], from: Date, to: Date): number {
  const days = new Set<string>();
  for (const log of logs) {
    const t = new Date(log.performedAt).getTime();
    if (t >= from.getTime() && t < to.getTime()) days.add(dayKeyOf(log));
  }
  return days.size;
}

export function volumeBetween(logs: LocalWorkoutLog[], from: Date, to: Date): number {
  return logs
    .filter((l) => {
      const t = new Date(l.performedAt).getTime();
      return t >= from.getTime() && t < to.getTime();
    })
    .reduce((sum, l) => sum + logVolume(l), 0);
}

// Consecutive weeks (ending with the current or, while this week is still empty, the previous
// one) with at least one trained day.
export function weekStreak(logs: LocalWorkoutLog[], now = new Date()): number {
  const weeks = new Set(logs.map((l) => utcDayKey(mondayOf(new Date(l.performedAt)))));
  const cursor = mondayOf(now);
  if (!weeks.has(utcDayKey(cursor))) cursor.setTime(cursor.getTime() - 7 * DAY_MS);
  let streak = 0;
  while (weeks.has(utcDayKey(cursor))) {
    streak += 1;
    cursor.setTime(cursor.getTime() - 7 * DAY_MS);
  }
  return streak;
}

// Days on which an exercise's heaviest set beat everything logged before for that exercise.
// The very first logged day of an exercise is a baseline, not a record. Returns the record count
// per UTC day key.
export function recordsByDay(logs: LocalWorkoutLog[]): Map<string, number> {
  const byExercise = new Map<string, LocalWorkoutLog[]>();
  for (const log of logs) {
    byExercise.set(log.exerciseId, [...(byExercise.get(log.exerciseId) ?? []), log]);
  }
  const result = new Map<string, number>();
  for (const sets of byExercise.values()) {
    const maxByDay = new Map<string, number>();
    for (const s of sets) maxByDay.set(dayKeyOf(s), Math.max(maxByDay.get(dayKeyOf(s)) ?? 0, s.weightKg));
    let best: number | null = null;
    for (const [day, max] of [...maxByDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (best !== null && max > best) result.set(day, (result.get(day) ?? 0) + 1);
      best = Math.max(best ?? 0, max);
    }
  }
  return result;
}

export function recordsBetween(logs: LocalWorkoutLog[], from: Date, to: Date): number {
  let total = 0;
  for (const [day, n] of recordsByDay(logs)) {
    const t = new Date(`${day}T00:00:00Z`).getTime();
    if (t >= from.getTime() && t < to.getTime()) total += n;
  }
  return total;
}

export function daysAgo(dayKey: string, now = new Date()): number {
  const today = new Date(`${utcDayKey(now)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((today - new Date(`${dayKey}T00:00:00Z`).getTime()) / DAY_MS));
}

export function formatDelta(value: number, digits = 0): string {
  const abs = Math.abs(value).toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${abs}`;
}

// Longest run of consecutive weeks with at least one trained day anywhere in `logs`.
export function longestWeekStreak(logs: LocalWorkoutLog[]): number {
  const weeks = [...new Set(logs.map((l) => mondayOf(new Date(l.performedAt)).getTime()))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const w of weeks) {
    run = prev !== null && w - prev === 7 * DAY_MS ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

// ISO calendar week number (1–53) of a date.
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}
