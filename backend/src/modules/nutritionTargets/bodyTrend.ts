import { localDayKey } from "../../lib/userTime.js";

// Weight trend and body-water context for the Kalorientracker's progress view. Read only: the
// measurements belong to the Fitnesstracker (BodyCompositionEntry). Nothing is estimated here:
// days without a measurement stay absent, and a missing water value stays null.

export interface BodyMeasurement {
  measuredAt: Date;
  weightKg: number;
  bodyWaterPercent: number | null;
  bodyFatPercent: number | null;
}

export interface BodyTrendPoint {
  date: string;
  weightKg: number;
  bodyWaterPercent: number | null;
  bodyFatPercent: number | null;
}

export interface BodyTrend {
  date: string;
  days: number;
  points: BodyTrendPoint[];
  latest: BodyTrendPoint | null;
  /** Mean weight of the measured days in the last 7 days and in the 7 days before. */
  avg7Kg: number | null;
  avgPrev7Kg: number | null;
  weeklyChangeKg: number | null;
  /** The two most recent days that both have a water value, for "was it water?". */
  water: { date: string; previousDate: string; weightChangeKg: number; waterChangePercentPoints: number } | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function addDayKeys(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const mean = (list: number[]) => (list.length ? r2(list.reduce((s, n) => s + n, 0) / list.length) : null);

/** One point per local day (the day's last measurement), oldest first, within `days` up to `today`. */
export function bodyTrend(measurements: BodyMeasurement[], timeZone: string, today: string, days: number): BodyTrend {
  const byDay = new Map<string, BodyMeasurement>();
  for (const m of [...measurements].sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime())) {
    byDay.set(localDayKey(m.measuredAt, timeZone), m);
  }
  const all: BodyTrendPoint[] = [...byDay.entries()]
    .filter(([date]) => date <= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, m]) => ({ date, weightKg: r2(m.weightKg), bodyWaterPercent: m.bodyWaterPercent, bodyFatPercent: m.bodyFatPercent }));

  const inRange = (from: number, to: number) => all.filter((p) => p.date >= addDayKeys(today, -to) && p.date <= addDayKeys(today, -from));
  const avg7Kg = mean(inRange(0, 6).map((p) => p.weightKg));
  const avgPrev7Kg = mean(inRange(7, 13).map((p) => p.weightKg));

  const withWater = all.filter((p) => p.bodyWaterPercent !== null);
  const [prev, last] = withWater.slice(-2);
  const water =
    prev && last && last.date >= addDayKeys(today, -(days - 1))
      ? {
          date: last.date,
          previousDate: prev.date,
          weightChangeKg: r2(last.weightKg - prev.weightKg),
          waterChangePercentPoints: Math.round((last.bodyWaterPercent! - prev.bodyWaterPercent!) * 10) / 10,
        }
      : null;

  const points = all.filter((p) => p.date >= addDayKeys(today, -(days - 1)));
  return {
    date: today,
    days,
    points,
    latest: points.at(-1) ?? null,
    avg7Kg,
    avgPrev7Kg,
    weeklyChangeKg: avg7Kg !== null && avgPrev7Kg !== null ? r2(avg7Kg - avgPrev7Kg) : null,
    water,
  };
}
