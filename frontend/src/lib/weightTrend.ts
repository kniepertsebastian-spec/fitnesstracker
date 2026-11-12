// The scale's single readings jump by a kilo or more from day to day (water, food, time of day).
// The trend is the mean over the last seven days; readings of one day are averaged first so a
// morning with five weigh-ins does not weigh five times as much.
const DAY_MS = 24 * 60 * 60 * 1000;
export const TREND_WINDOW_DAYS = 7;

export interface WeightPoint {
  measuredAt: string;
  weightKg: number;
}

/** Mean of the daily mean weights in the window of `TREND_WINDOW_DAYS` ending at `at` (inclusive). */
export function weightTrendAt(points: WeightPoint[], at: string | Date): number | null {
  const end = new Date(at).getTime();
  const start = end - TREND_WINDOW_DAYS * DAY_MS;
  const byDay = new Map<string, number[]>();
  for (const point of points) {
    const time = new Date(point.measuredAt).getTime();
    if (time > end || time <= start) continue;
    const day = point.measuredAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), point.weightKg]);
  }
  if (byDay.size === 0) return null;
  const dayMeans = [...byDay.values()].map((values) => values.reduce((a, b) => a + b, 0) / values.length);
  return dayMeans.reduce((a, b) => a + b, 0) / dayMeans.length;
}
