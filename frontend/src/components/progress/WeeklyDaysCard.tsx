import { useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { isoWeek, mondayOf } from "../../lib/stats";
import { utcDayKey } from "../../lib/dates";
import { Card, cn } from "../ui";

const WEEKS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

// Training days per week for the last 12 weeks (not raw set count, so three quick sets on one day
// don't outweigh a full session on another). Goal-met weeks are mint, the rest neutral.
export function WeeklyDaysCard({ targetDays }: { targetDays: number | null }) {
  const { data: logs } = useWorkoutLogs();
  const thisMonday = mondayOf(new Date());
  const weeks = Array.from({ length: WEEKS }, (_, i) => new Date(thisMonday.getTime() - (WEEKS - 1 - i) * 7 * DAY_MS));

  const daysByWeek = new Map<string, Set<string>>();
  for (const log of logs ?? []) {
    const d = new Date(log.performedAt);
    const key = utcDayKey(mondayOf(d));
    daysByWeek.set(key, (daysByWeek.get(key) ?? new Set()).add(utcDayKey(d)));
  }
  const counts = weeks.map((w) => daysByWeek.get(utcDayKey(w))?.size ?? 0);
  const goal = targetDays ?? 3;
  const max = Math.max(7, ...counts);
  const summary = weeks
    .map((w, i) => `KW ${isoWeek(w)}: ${counts[i]} ${counts[i] === 1 ? "Tag" : "Tage"}`)
    .join(", ");

  return (
    <Card title="Trainingstage pro Woche" action={<span className="text-small text-text-subtle">Ziel {goal}</span>}>
      <div role="img" aria-label={`Trainingstage pro Woche. ${summary}`} className="flex h-32 items-end gap-1.5">
        {weeks.map((w, i) => (
          <div key={w.getTime()} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={cn("w-full rounded-sm", counts[i] >= goal ? "bg-accent" : counts[i] > 0 ? "bg-info" : "bg-track")}
              style={{ height: `${Math.max(counts[i] > 0 ? 8 : 4, (counts[i] / max) * 100)}%` }}
              title={`KW ${isoWeek(w)}: ${counts[i]}`}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-1.5">
        {weeks.map((w) => (
          <span key={w.getTime()} className="tabular flex-1 text-center font-mono text-[10px] text-text-faint">
            {isoWeek(w)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-faint">Mint: Ziel erreicht · Blau: Training, Ziel verfehlt · Zahlen: Kalenderwoche.</p>
    </Card>
  );
}
