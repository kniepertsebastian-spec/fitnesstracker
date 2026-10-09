import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import type { LocalWorkoutLog } from "../../offline/db";
import { dayKeyOf, logVolume, recordsByDay } from "../../lib/stats";
import { formatKg } from "../../lib/trainingSets";
import { Card, EmptyState } from "../ui";

export interface WorkoutDay {
  day: string;
  sets: number;
  volume: number;
  records: number;
  exercises: string[];
}

export function lastWorkoutDays(logs: LocalWorkoutLog[], limit: number): WorkoutDay[] {
  const records = recordsByDay(logs);
  const byDay = new Map<string, LocalWorkoutLog[]>();
  for (const log of logs) byDay.set(dayKeyOf(log), [...(byDay.get(dayKeyOf(log)) ?? []), log]);
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, limit)
    .map(([day, sets]) => ({
      day,
      sets: sets.length,
      volume: sets.reduce((sum, s) => sum + logVolume(s), 0),
      records: records.get(day) ?? 0,
      exercises: [...new Set(sets.map((s) => s.exerciseName))],
    }));
}

function formatDay(day: string, long = false) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: long ? "long" : "short",
    timeZone: "UTC",
  });
}

// Mobile tile: only the most recent training.
export function LastWorkoutTile({ days }: { days: WorkoutDay[] }) {
  const last = days[0];
  return (
    <Card
      title="Letztes Training"
      action={
        <Link to="/history" className="text-small text-accent hover:text-accent-hover">
          Historie
        </Link>
      }
    >
      {last ? (
        <>
          <p className="text-body font-medium text-text">{formatDay(last.day, true)}</p>
          <p className="tabular text-small text-text-subtle">
            {last.sets} Sätze · {formatKg(Math.round(last.volume))} kg
          </p>
          <p className="mt-1 truncate text-small text-text-faint">
            {last.exercises.slice(0, 3).join(", ")}
            {last.exercises.length > 3 ? ` +${last.exercises.length - 3}` : ""}
          </p>
        </>
      ) : (
        <EmptyState className="py-4" icon={<Dumbbell size={18} aria-hidden />} text="Noch kein Training geloggt." />
      )}
    </Card>
  );
}

// Desktop table: date, training, sets, volume, records.
export function RecentWorkoutsTable({ days }: { days: WorkoutDay[] }) {
  return (
    <Card
      title="Letzte Trainings"
      action={
        <Link to="/history" className="text-small text-accent hover:text-accent-hover">
          Historie
        </Link>
      }
    >
      {days.length === 0 ? (
        <EmptyState icon={<Dumbbell size={18} aria-hidden />} text="Noch kein Training geloggt." />
      ) : (
        <table className="w-full text-small">
          <thead>
            <tr className="text-left text-overline uppercase text-text-faint">
              <th className="pb-2 font-semibold">Datum</th>
              <th className="pb-2 font-semibold">Training</th>
              <th className="pb-2 text-right font-semibold">Sätze</th>
              <th className="pb-2 text-right font-semibold">Volumen</th>
              <th className="pb-2 text-right font-semibold">Rekorde</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className="border-t border-border-subtle">
                <td className="py-3 text-text">{formatDay(d.day)}</td>
                <td className="max-w-[16rem] truncate py-3 text-text-muted">
                  {d.exercises.slice(0, 3).join(", ")}
                  {d.exercises.length > 3 ? ` +${d.exercises.length - 3}` : ""}
                </td>
                <td className="tabular py-3 text-right font-mono text-text-2">{d.sets}</td>
                <td className="tabular py-3 text-right font-mono text-text-2">{formatKg(Math.round(d.volume))} kg</td>
                <td className="tabular py-3 text-right font-mono text-text-2">{d.records}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
