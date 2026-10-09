import { Check, Flame } from "lucide-react";
import { Badge, Card, ProgressBar, cn } from "../ui";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

interface Props {
  weekKeys: string[];
  today: string;
  trainedDays: ReadonlySet<string>;
  volumeByDay: ReadonlyMap<string, number>;
  weekStreak: number;
  targetDays: number | null;
}

export function WeekCard({ weekKeys, today, trainedDays, volumeByDay, weekStreak, targetDays }: Props) {
  const trainedThisWeek = weekKeys.filter((k) => trainedDays.has(k)).length;
  const maxVolume = Math.max(1, ...weekKeys.map((k) => volumeByDay.get(k) ?? 0));

  return (
    <Card
      title="Diese Woche"
      action={
        weekStreak > 0 ? (
          <Badge tone="warning">
            <Flame size={12} aria-hidden /> {weekStreak} {weekStreak === 1 ? "Woche" : "Wochen"} Serie
          </Badge>
        ) : (
          <span className="text-small text-text-faint">Noch keine Serie</span>
        )
      }
    >
      {/* Mobile: seven day tiles */}
      <div className="flex justify-between lg:hidden">
        {weekKeys.map((key, i) => {
          const trained = trainedDays.has(key);
          return (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg text-text",
                  trained
                    ? "bg-accent-soft text-accent"
                    : key === today
                      ? "border border-accent bg-surface-2"
                      : "bg-surface-2",
                )}
                aria-label={`${WEEKDAYS[i]}: ${trained ? "trainiert" : key === today ? "heute" : "kein Training"}`}
              >
                {trained && <Check size={18} strokeWidth={2.6} aria-hidden />}
              </span>
              <span className={cn("text-xs", key === today ? "text-text" : "text-text-faint")}>{WEEKDAYS[i]}</span>
            </div>
          );
        })}
      </div>

      {/* Desktop: bars, height = daily volume */}
      <div className="hidden h-28 items-end justify-between gap-3 lg:flex">
        {weekKeys.map((key, i) => {
          const volume = volumeByDay.get(key) ?? 0;
          return (
            <div key={key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div
                className={cn(
                  "w-full rounded-sm",
                  trainedDays.has(key) ? "bg-accent" : key === today ? "border border-accent" : "bg-track",
                )}
                style={{ height: `${Math.max(8, (volume / maxVolume) * 100)}%` }}
                title={volume > 0 ? `${Math.round(volume)} kg Volumen` : undefined}
              />
              <span className={cn("text-xs", key === today ? "text-text" : "text-text-faint")}>{WEEKDAYS[i]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-small text-text-subtle">
          <span>Trainingstage</span>
          <span className="tabular">
            {trainedThisWeek}
            {targetDays ? ` von ${targetDays}` : ""}
          </span>
        </div>
        <ProgressBar
          value={targetDays ? (trainedThisWeek / targetDays) * 100 : trainedThisWeek > 0 ? 100 : 0}
          size={6}
          label="Trainingstage diese Woche"
        />
      </div>
    </Card>
  );
}
