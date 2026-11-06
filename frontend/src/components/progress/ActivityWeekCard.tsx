import { Link } from "react-router-dom";
import type { ActivityWeek } from "@fitnesstracker/shared";
import { useHealthSyncStatus, useWeeklyActivityReport } from "../../hooks/useActivity";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Card, Skeleton } from "../ui";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const number = (value: number, digits = 0) => value.toLocaleString("de-DE", { maximumFractionDigits: digits });

function WeekSummary({ week, title }: { week: ActivityWeek; title: string }) {
  const { steps, cyclingOutdoor, cyclingStudio, strength } = week;
  return (
    <div>
      <p className="text-small font-medium text-text-2">{title}</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-small text-text-subtle">
        <dt>Schritte</dt>
        <dd className="text-right text-text-2">
          {steps.daysWithData > 0 ? `${number(steps.total)} · Ø ${number(steps.averagePerDay ?? 0)}/Tag` : "–"}
        </dd>
        <dt>Rad draußen</dt>
        <dd className="text-right text-text-2">
          {cyclingOutdoor.rides > 0
            ? `${number(cyclingOutdoor.totalMinutes)} Min.${cyclingOutdoor.totalKm === null ? "" : ` · ${number(cyclingOutdoor.totalKm, 1)} km`}`
            : "–"}
        </dd>
        <dt>Rad Studio</dt>
        <dd className="text-right text-text-2">{cyclingStudio.rides > 0 ? `${number(cyclingStudio.totalMinutes)} Min.` : "–"}</dd>
        <dt>Krafttraining</dt>
        <dd className="text-right text-text-2">
          {strength.sets > 0 ? `${strength.trainingDays} Tage · ${number(strength.volumeKg)} kg` : "–"}
        </dd>
      </dl>
    </div>
  );
}

// This week's steps per day, plus this and last week side by side. Fed by the weekly report that
// the exports use; the phone pushes Health Connect data in the background.
export function ActivityWeekCard() {
  const { data: report, isLoading } = useWeeklyActivityReport(2);
  const { data: sync } = useHealthSyncStatus();

  if (isLoading || !report) return <Skeleton className="h-48 w-full" />;
  const [last, current] = report.weeks;
  const maxSteps = Math.max(1, ...current.steps.days.map((d) => d.steps ?? 0));
  const hasSteps = report.totals.steps.daysWithData > 0;
  const summary = current.steps.days
    .map((d, i) => `${WEEKDAYS[i]}: ${d.steps === null ? "keine Daten" : number(d.steps)}`)
    .join(", ");

  return (
    <Card title="Schritte & Rad" action={<CalcInfoButton id="activity-report" />}>
      {hasSteps ? (
        <div role="img" aria-label={`Schritte diese Woche. ${summary}`} className="flex h-24 items-end gap-1.5">
          {current.steps.days.map((day, i) => (
            <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-sm bg-accent"
                style={{ height: day.steps === null ? 0 : `${Math.max(4, (day.steps / maxSteps) * 100)}%` }}
              />
              <span className="text-xs text-text-faint">{WEEKDAYS[i]}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-small text-text-subtle">
          Noch keine Schritte.{" "}
          {sync?.connected ? (
            "Sobald die Android-App überträgt, erscheinen sie hier."
          ) : (
            <>
              Richte die Übertragung aus Health Connect{" "}
              <Link to="/settings" className="text-accent-text hover:text-accent-text-hover">
                in den Einstellungen
              </Link>{" "}
              ein.
            </>
          )}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WeekSummary week={current} title="Diese Woche" />
        <WeekSummary week={last} title="Letzte Woche" />
      </div>
    </Card>
  );
}
