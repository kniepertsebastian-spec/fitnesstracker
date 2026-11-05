import { Dumbbell } from "lucide-react";
import { CalcInfoButton } from "../info/CalcInfoButton";

import { STRETCH_FOCUS_LABELS, type StretchFocusMuscle } from "@fitnesstracker/shared";
import { useWeeklyMuscleVolume } from "../../hooks/useMuscleVolume";
import { Card, EmptyState, Skeleton, cn } from "../ui";

const WEEKS = 4;
// Common guide value for muscle growth: roughly 10–20 hard sets per muscle and week.
const TARGET_MIN = 10;
const TARGET_MAX = 20;

const label = (muscle: string) => STRETCH_FOCUS_LABELS[muscle as StretchFocusMuscle] ?? muscle;

// Sets per primary muscle this week, with last week and the 4-week average for context.
export function MuscleVolumeCard() {
  const { data, isLoading, isError } = useWeeklyMuscleVolume(WEEKS);

  if (isLoading) {
    return (
      <Card title="Sätze pro Muskel">
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  const weeks = data?.weeks ?? [];
  const current = weeks.at(-1)?.sets ?? {};
  const previous = weeks.at(-2)?.sets ?? {};
  const muscles = [...new Set(weeks.flatMap((w) => Object.keys(w.sets)))];
  const rows = muscles
    .map((muscle) => ({
      muscle,
      now: current[muscle] ?? 0,
      last: previous[muscle] ?? 0,
      average: weeks.reduce((sum, w) => sum + (w.sets[muscle] ?? 0), 0) / WEEKS,
    }))
    .sort((a, b) => b.now - a.now || b.average - a.average);
  const scale = Math.max(TARGET_MAX, ...rows.map((r) => r.now));

  return (
    <Card title="Sätze pro Muskel" action={
        <span className="flex items-center gap-1 text-small text-text-subtle">
          diese Woche <CalcInfoButton id="muscle-volume" />
        </span>
      }
    >
      {isError ? (
        <p className="text-small text-text-subtle">Die Auswertung ist gerade nicht erreichbar.</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Dumbbell size={20} />} text="Noch keine Sätze. Sobald du trainierst, siehst du hier die Sätze pro Muskelgruppe." />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <li key={row.muscle}>
                <div className="flex items-baseline justify-between gap-2 text-small">
                  <span className="text-text">{label(row.muscle)}</span>
                  <span className="tabular text-text-subtle">
                    <span className="font-medium text-text">{row.now}</span> · Vorwoche {row.last} · Ø{" "}
                    {row.average.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={`${label(row.muscle)}: ${row.now} Sätze diese Woche`}
                  className="relative mt-1 h-2 overflow-hidden rounded-full bg-track"
                >
                  <div
                    className={cn("h-full rounded-full", row.now >= TARGET_MIN ? "bg-accent" : "bg-info")}
                    style={{ width: `${(row.now / scale) * 100}%` }}
                  />
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-px bg-text-faint"
                    style={{ left: `${(TARGET_MIN / scale) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-small text-text-subtle">
            Gezählt wird der Hauptmuskel jeder Übung. Richtwert für Muskelaufbau: {TARGET_MIN}–{TARGET_MAX} Sätze pro
            Muskel und Woche (Strich bei {TARGET_MIN}).
          </p>
        </>
      )}
    </Card>
  );
}
