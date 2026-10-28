import { useEffect, useState } from "react";
import { ArrowLeftRight, CalendarPlus, Pause, Play, RotateCcw } from "lucide-react";
import {
  TRAINING_GOAL_LABELS,
  TRAINING_GOALS,
  TRAINING_PHASE_ROTATION,
  type TrainingGoalValue,
  type TrainingPhase,
  type TrainingPlanDto,
} from "@fitnesstracker/shared";
import {
  useChangeTrainingPhase,
  useExtendPhase,
  usePauseTrainingPlan,
  useRestartPhase,
  useResumeTrainingPlan,
  useSetTrainingGoal,
} from "../../hooks/useTrainingPlan";
import { getPhaseDisplayName, PHASE_RULES } from "../../lib/phaseInfo";
import { phaseLength, phaseWeek } from "../../lib/phase";
import { Button, Callout, Card, Dialog, Field, SegmentedProgress, Select } from "../ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

export function PhaseHero({ plan }: { plan: TrainingPlanDto }) {
  const pause = usePauseTrainingPlan();
  const resume = useResumeTrainingPlan();
  const restart = useRestartPhase();
  const extend = useExtendPhase();
  const setGoal = useSetTrainingGoal();
  const changePhase = useChangeTrainingPhase();
  const [phaseChangeOpen, setPhaseChangeOpen] = useState(false);
  const [phaseToSwitch, setPhaseToSwitch] = useState(plan.currentPhase);

  useEffect(() => {
    setPhaseToSwitch(plan.currentPhase);
  }, [plan.currentPhase]);

  const rotationalPhases =
    plan.phases?.filter((p) => !p.isDaily).map((p) => p.phase) ?? TRAINING_PHASE_ROTATION;
  const currentIdx = rotationalPhases.indexOf(plan.currentPhase);
  const next =
    rotationalPhases[(currentIdx === -1 ? 0 : currentIdx + 1) % rotationalPhases.length] ??
    plan.currentPhase;

  const total = phaseLength(plan);
  const week = phaseWeek(plan);
  const busy =
    pause.isPending || resume.isPending || restart.isPending || extend.isPending || changePhase.isPending;

  return (
    <Card variant="hero" className="lg:p-6">
      <p className="text-overline uppercase text-accent">Aktuelle Phase</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <h2 className="text-h2-hero text-text lg:text-[26px]">
          {getPhaseDisplayName(plan.currentPhase, plan.phases)}
        </h2>
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
        {(PHASE_RULES[plan.currentPhase] ?? "Individuelle Phase").replace(/\.$/, "")}.{" "}
        {plan.pausedAt
          ? `Pausiert seit ${formatDate(plan.pausedAt)}.`
          : plan.nextRotationOn && rotationalPhases.length > 1
            ? `Danach folgt ${getPhaseDisplayName(next, plan.phases)} ab ${formatDate(plan.nextRotationOn)}.`
            : null}
      </p>

      <Field
        label="Trainingsziel"
        hint="Bestimmt den Cardio-Vorschlag für jeden Trainingstag. Ohne Ziel gibt es keinen Vorschlag."
        className="mt-4 rounded-lg border border-border-hero bg-surface-inset p-3"
      >
        {(p) => (
          <Select
            {...p}
            value={plan.trainingGoal ?? ""}
            disabled={setGoal.isPending}
            onChange={(e) => setGoal.mutate(e.target.value === "" ? null : (e.target.value as TrainingGoalValue))}
          >
            <option value="">Noch nicht gewählt</option>
            {TRAINING_GOALS.map((g) => (
              <option key={g} value={g}>
                {TRAINING_GOAL_LABELS[g]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {setGoal.isError && (
        <Callout tone="danger" className="mt-3">
          Ziel konnte nicht gespeichert werden. Plan-Änderungen brauchen eine Verbindung.
        </Callout>
      )}

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
        {rotationalPhases.length > 1 && (
          <Button
            variant="secondary"
            iconLeft={<ArrowLeftRight size={16} aria-hidden />}
            disabled={busy}
            onClick={() => setPhaseChangeOpen(true)}
          >
            Phase wechseln
          </Button>
        )}
      </div>

      {changePhase.isError && (
        <Callout tone="danger" className="mt-3">
          Die Trainingsphase konnte nicht gewechselt werden. Bitte versuche es erneut.
        </Callout>
      )}

      <Dialog
        open={phaseChangeOpen}
        onOpenChange={setPhaseChangeOpen}
        title="Trainingsphase wechseln"
        description="Die neue Phase beginnt mit einem frischen 8-Wochen-Zeitraum. Deine Trainingslogs bleiben erhalten."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPhaseChangeOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              disabled={busy || phaseToSwitch === plan.currentPhase}
              onClick={() =>
                changePhase.mutate(phaseToSwitch, {
                  onSuccess: () => setPhaseChangeOpen(false),
                })
              }
            >
              Phase wechseln
            </Button>
          </>
        }
      >
        <Field label="Neue Phase" hint="Die bisherige Phase wird im Verlauf mit ihrem Enddatum abgeschlossen.">
          {(p) => (
            <Select
              {...p}
              value={phaseToSwitch}
              disabled={busy}
              onChange={(event) => setPhaseToSwitch(event.target.value as TrainingPhase)}
            >
              {rotationalPhases.map((phase) => (
                <option key={phase} value={phase} disabled={phase === plan.currentPhase}>
                  {getPhaseDisplayName(phase, plan.phases)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Dialog>
    </Card>
  );
}
