import { Link } from "react-router-dom";
import { CalendarCheck, PauseCircle } from "lucide-react";
import type { TrainingPlanDto, WeeklyPlanStatusDto } from "@fitnesstracker/shared";
import { useCardioPlan } from "../../hooks/useCardioPlan";
import { useStretchPlan } from "../../hooks/useStretching";
import { TRAINING_PHASE_LABELS } from "../../hooks/useTrainingPlan";
import { cardioMinutes, matchDay, stretchMinutes } from "../../lib/dayPlan";
import type { LocalWorkoutSession } from "../../offline/db";
import { StartTrainingButton } from "../layout/StartTrainingButton";
import { Badge, ButtonLink, Callout, Card, ListRow } from "../ui";

interface Props {
  plan: TrainingPlanDto | undefined;
  status: WeeklyPlanStatusDto | undefined;
  session: LocalWorkoutSession | null | undefined;
  lastTrainedDaysAgo: number | null;
}

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function agoText(days: number) {
  return days === 0 ? "heute" : days === 1 ? "zuletzt gestern" : `zuletzt vor ${days} Tagen`;
}

export function HeroCard({ plan, status, session, lastTrainedDaysAgo }: Props) {
  // F9: the hero names the whole day (strength, cardio, stretching), not only the exercises.
  const { data: cardioPlan } = useCardioPlan(plan?.currentPhase, { enabled: !!plan });
  const { data: stretchPlan } = useStretchPlan(plan?.currentPhase ?? "AUFBAU");

  if (!plan) {
    return (
      <Card variant="hero">
        <p className="text-overline uppercase text-accent">Heute dran</p>
        <h2 className="mt-1 text-h2-hero text-text">Noch kein Trainingsplan</h2>
        <p className="mt-1 text-small text-text-subtle">Lege einen Plan an, dann siehst du hier dein Training für heute.</p>
        <ButtonLink to="/plan" variant="primary" size="lg" className="mt-4" fullWidth>
          Plan anlegen
        </ButtonLink>
      </Card>
    );
  }

  const activeDay = status && status.activeDayIndex !== null ? status.days[status.activeDayIndex] : null;
  const allDone = !!status && status.days.length > 0 && status.activeDayIndex === null;

  if (plan.pausedAt) {
    return (
      <Card variant="hero">
        <p className="text-overline uppercase text-accent">Heute dran</p>
        <h2 className="mt-1 text-h2-hero text-text">Plan pausiert</h2>
        <Callout tone="warning" className="mt-3">
          Dein Trainingsplan ist pausiert, die Phase läuft nicht weiter.{" "}
          <Link to="/plan" className="font-medium text-text underline">
            Zum Plan
          </Link>
        </Callout>
      </Card>
    );
  }

  if (allDone) {
    return (
      <Card variant="hero">
        <p className="text-overline uppercase text-accent">Heute dran</p>
        <h2 className="mt-1 flex items-center gap-2 text-h2-hero text-text">
          <CalendarCheck size={24} aria-hidden className="text-accent" /> Woche geschafft
        </h2>
        <p className="mt-1 text-small text-text-subtle">
          Alle Trainingstage dieser Woche sind erledigt. Ab Montag geht es mit Tag 1 weiter.
        </p>
        <div className="mt-4">
          <StartTrainingButton size="lg" fullWidth variant="secondary" />
        </div>
      </Card>
    );
  }

  if (!activeDay) {
    return (
      <Card variant="hero">
        <p className="text-overline uppercase text-accent">Heute dran</p>
        <h2 className="mt-1 text-h2-hero text-text">Keine Übungen im Plan</h2>
        <p className="mt-1 text-small text-text-subtle">
          Für die Phase {TRAINING_PHASE_LABELS[plan.currentPhase]} sind noch keine Übungen hinterlegt.
        </p>
        <ButtonLink to="/plan" variant="primary" size="lg" className="mt-4" fullWidth>
          Übungen hinzufügen
        </ButtonLink>
      </Card>
    );
  }

  const sets = activeDay.exercises.reduce((sum, e) => sum + (e.targetSets ?? 3), 0);
  const cardioMin = cardioMinutes(matchDay(cardioPlan?.days, activeDay.dayLabel)?.items ?? []);
  const stretchMin = stretchMinutes(matchDay(stretchPlan?.days, activeDay.dayLabel)?.items ?? []);
  const minutes = Math.max(5, Math.round((sets * 3 + cardioMin + stretchMin) / 5) * 5);
  const shown = activeDay.exercises.slice(0, 3);
  const more = activeDay.exercises.length - shown.length;
  const title = activeDay.dayLabel ?? `Tag ${(status!.activeDayIndex ?? 0) + 1}`;

  return (
    <Card variant="hero" className="lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-overline uppercase text-accent">Heute dran</p>
        {session ? (
          <Badge tone="info">
            {session.status === "PAUSED" ? <PauseCircle size={12} aria-hidden /> : null}
            {session.status === "PAUSED" ? "pausiert" : `läuft seit ${minutesSince(session.startedAt)} Min.`}
          </Badge>
        ) : (
          lastTrainedDaysAgo !== null && (
            <span className="text-xs text-text-faint">{agoText(lastTrainedDaysAgo)}</span>
          )
        )}
      </div>
      <h2 className="mt-1 text-h2-hero text-text">{title}</h2>
      <p className="mt-1 text-small text-text-subtle">
        {[
          `${activeDay.exercises.length} Übungen`,
          cardioMin > 0 ? `${cardioMin} Min. Cardio` : null,
          stretchMin > 0 ? `${stretchMin} Min. Dehnen` : null,
          `ca. ${minutes} Min.`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mt-3">
        {shown.map((e, i) => (
          <ListRow key={e.id} prefix={i + 1} value={`${e.targetSets ?? 3} × ${e.targetReps ?? "–"}`}>
            {e.exerciseName}
          </ListRow>
        ))}
        {more > 0 && <p className="border-t border-border-subtle pt-3 text-small text-text-faint">+ {more} weitere</p>}
      </div>

      <div className="mt-4">
        <StartTrainingButton size="lg" fullWidth className="lg:w-auto" />
      </div>
    </Card>
  );
}
