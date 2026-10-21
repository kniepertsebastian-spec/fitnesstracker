import type { WeeklyMuscleVolumeDto } from "@fitnesstracker/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

function mondayUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

// Monday of the oldest week included when looking back `weeks` weeks (the current one counts).
export function muscleVolumeStart(weeks: number, now = new Date()): Date {
  return new Date(mondayUtc(now).getTime() - (weeks - 1) * 7 * DAY_MS);
}

// One set counts once for each of its exercise's primary muscles. Secondary muscles are left out
// on purpose: counting them would double the numbers of every compound lift.
export function weeklyMuscleSets(
  rows: { performedAt: Date; primaryMuscles: string[] }[],
  weeks: number,
  now = new Date(),
): WeeklyMuscleVolumeDto {
  const start = muscleVolumeStart(weeks, now).getTime();
  const result: WeeklyMuscleVolumeDto["weeks"] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(start + i * 7 * DAY_MS).toISOString().slice(0, 10),
    sets: {},
  }));
  for (const row of rows) {
    const index = Math.floor((mondayUtc(row.performedAt).getTime() - start) / (7 * DAY_MS));
    if (index < 0 || index >= weeks) continue;
    for (const muscle of row.primaryMuscles) {
      result[index].sets[muscle] = (result[index].sets[muscle] ?? 0) + 1;
    }
  }
  return { weeks: result };
}
