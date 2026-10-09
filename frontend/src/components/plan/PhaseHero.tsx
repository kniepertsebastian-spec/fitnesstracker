import { CalendarPlus, Pause, Play, RotateCcw } from "lucide-react";
import { TRAINING_PHASE_ROTATION, type TrainingPlanDto } from "@fitnesstracker/shared";
import {
  TRAINING_PHASE_LABELS,
  useExtendPhase,
  usePauseTrainingPlan,
  useRestartPhase,
  useResumeTrainingPlan,
} from "../../hooks/useTrainingPlan";
import { PHASE_RULES } from "../../lib/phaseInfo";
import { phaseLength, phaseWeek } from "../../lib/phase";
import { Button, Callout, Card, SegmentedProgress } from "../ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

export function PhaseHero({ plan }: { plan: TrainingPlanDto }) {
  const pause = usePauseTrainingPlan();
  const resume = useResumeTrainingPlan();
  const restart = useRestartPhase();
  const extend = useExtendPhase();

  const total = phaseLength(plan);
  const week = phaseWeek(plan);
  const next = TRAINING_PHASE_ROTATION[(TRAINING_PHASE_ROTATION.indexOf(plan.currentPhase) + 1) % TRAINING_PHASE_ROTATION.length];
  const busy = pause.isPending || resume.isPending || restart.isPending || extend.isPending;

  return (
    <Card variant="hero" className="lg:p-6">
      <p className="text-overline uppercase text-accent">Aktuelle Phase</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h2 className="text-h2-hero text-text lg:text-[26px]">{TRAINING_PHASE_LABELS[plan.currentPhase]}</h2>
        <span className="tabular font-mono text-small text-text-subtle">
          Woche {week} von {total}
        </span>
      </div>
      <SegmentedProgress
        className="mt-3"
        segments={total}
        done={week - 1}
        size={8}
        label={`Phasenfortschritt: Woche ${week} von ${total}`}
      />
      <p className="mt-3 text-small text-text-2">
        {PHASE_RULES[plan.currentPhase].replace(/\.$/, "")}.{" "}
        {plan.pausedAt
          ? `Pausiert seit ${formatDate(plan.pausedAt)}.`
          : plan.nextRotationOn
            ? `Danach folgt ${TRAINING_PHASE_LABELS[next]} ab ${formatDate(plan.nextRotationOn)}.`
            : null}
      </p>

      {plan.pausedAt && (
        <Callout tone="warning" className="mt-3">
          Die Phase ist pausiert und läuft erst nach dem Fortsetzen weiter.
        </Callout>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {plan.pausedAt ? (
          <Button variant="primary" iconLeft={<Play size={16} aria-hidden />} disabled={busy} onClick={() => resume.mutate()}>
            Fortsetzen
          </Button>
        ) : (
          <Button variant="secondary" iconLeft={<Pause size={16} aria-hidden />} disabled={busy} onClick={() => pause.mutate()}>
            Pausieren
          </Button>
        )}
        <Button
          variant="secondary"
          iconLeft={<CalendarPlus size={16} aria-hidden />}
          disabled={busy || (plan.extensionWeeks ?? 0) >= 8}
          onClick={() => extend.mutate()}
        >
          +1 Woche
        </Button>
        <Button variant="ghost" iconLeft={<RotateCcw size={16} aria-hidden />} disabled={busy} onClick={() => restart.mutate()}>
          Neu starten
        </Button>
      </div>
    </Card>
  );
}
