import { useEffect, useState } from "react";
import { BookOpen, Link2, Plus } from "lucide-react";
import type { ExerciseDto, PlanDiaryExerciseDto, TrainingPhase } from "@fitnesstracker/shared";
import type { LocalWorkoutLog } from "../../offline/db";
import { formatKg } from "../../lib/trainingSets";
import { Badge, Button, Card, SegmentedControl, SetCheck, Stepper, cn } from "../ui";
import type { SetCheckState } from "../ui";

const PROGRESSION_LABEL: Record<TrainingPhase, string> = {
  AUFBAU: "Gewicht steigern",
  MUSKELAUSDAUER: "Wdh. steigern",
  NEGATIV: "langsam ablassen",
};

export interface SetValues {
  weightKg: number;
  reps: number;
  rir: number | null;
}

interface Props {
  entry: PlanDiaryExerciseDto;
  phase: TrainingPhase;
  exercise: ExerciseDto | undefined;
  done: LocalWorkoutLog[];
  previous: LocalWorkoutLog[];
  setCount: number;
  disabled: boolean;
  busy: boolean;
  supersetActive: boolean;
  onSetCountChange: (count: number) => void;
  onLogSet: (values: SetValues, setNumber: number) => void;
  onUndoSet: (log: LocalWorkoutLog) => void;
  onToggleSuperset: () => void;
  onOpenTechnique: () => void;
}

function initialValues(entry: PlanDiaryExerciseDto, done: LocalWorkoutLog[], previous: LocalWorkoutLog[]): SetValues {
  const last = done.at(-1);
  if (last) return { weightKg: last.weightKg, reps: last.reps, rir: null };
  const p = entry.progression;
  const prev = previous[0];
  return {
    weightKg: p ? p.suggestedWeightKg : (prev?.weightKg ?? 0),
    reps: p ? p.suggestedReps : (entry.targetReps ?? prev?.reps ?? 10),
    rir: null,
  };
}

export function ExerciseCard({
  entry,
  phase,
  exercise,
  done,
  previous,
  setCount,
  disabled,
  busy,
  supersetActive,
  onSetCountChange,
  onLogSet,
  onUndoSet,
  onToggleSuperset,
  onOpenTechnique,
}: Props) {
  const [values, setValues] = useState<SetValues>(() => initialValues(entry, done, previous));

  // After a set is logged (or undone) the next one starts from the last logged values.
  useEffect(() => {
    setValues(initialValues(entry, done, previous));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.length, entry.id]);

  const currentIndex = done.length;
  const complete = done.length >= setCount;
  const p = entry.progression;
  const lastTime = previous[0];

  return (
    <Card className="rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-2">
        {exercise?.primaryMuscles.slice(0, 2).map((m) => (
          <Badge key={m} tone="info">
            {m}
          </Badge>
        ))}
        <Badge tone="accent">{PROGRESSION_LABEL[phase]}</Badge>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <h1 className="text-h1-focus text-text">{entry.exerciseName}</h1>
        <Button
          size="sm"
          variant="ghost"
          iconLeft={<BookOpen size={16} aria-hidden />}
          onClick={onOpenTechnique}
        >
          Technik
        </Button>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-small">
        <div className="flex gap-1.5">
          <dt className="text-text-subtle">Letztes Mal</dt>
          <dd className="tabular font-mono text-text-2">
            {lastTime ? `${previous.length} × ${lastTime.reps} · ${formatKg(lastTime.weightKg)} kg` : "–"}
          </dd>
        </div>
        {p && (
          <div className="flex gap-1.5">
            <dt className="text-text-subtle">Vorschlag</dt>
            <dd className="tabular font-mono text-accent">
              {p.mode === "weight" ? `${formatKg(p.suggestedWeightKg)} kg` : `${p.suggestedReps} Wdh.`}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-4">
        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_3rem] items-center gap-2 px-1 pb-2 text-overline uppercase text-text-faint">
          <span>Satz</span>
          <span>Vorher</span>
          <span>kg</span>
          <span>Wdh.</span>
          <span className="sr-only">Erledigt</span>
        </div>

        {Array.from({ length: setCount }, (_, i) => {
          const log = done[i];
          const state: SetCheckState = log ? "done" : i === currentIndex ? "current" : "open";
          const prev = previous[i];
          const shownKg = log ? log.weightKg : values.weightKg;
          const shownReps = log ? log.reps : values.reps;
          return (
            <div key={i} className="border-t border-border-subtle py-2 first:border-t-0">
              <div className="grid grid-cols-[2rem_1fr_1fr_1fr_3rem] items-center gap-2 px-1">
                <span className="tabular font-mono text-small text-text-subtle">{i + 1}</span>
                <span className="tabular font-mono text-small text-text-faint">
                  {prev ? `${formatKg(prev.weightKg)} × ${prev.reps}` : "–"}
                </span>
                <span
                  className={cn(
                    "tabular font-mono text-body",
                    state === "open" ? "text-text-faint" : "text-text",
                  )}
                >
                  {formatKg(shownKg)}
                </span>
                <span
                  className={cn(
                    "tabular font-mono text-body",
                    state === "open" ? "text-text-faint" : "text-text",
                  )}
                >
                  {shownReps}
                </span>
                <SetCheck
                  state={state}
                  disabled={disabled || busy || state === "open"}
                  aria-label={
                    state === "done" ? `Satz ${i + 1} rückgängig` : `Satz ${i + 1} abhaken`
                  }
                  onClick={() => (log ? onUndoSet(log) : onLogSet(values, i + 1))}
                />
              </div>

              {state === "current" && (
                <div className="mt-3 flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Stepper
                      label="Gewicht"
                      value={values.weightKg}
                      step={2.5}
                      unit="kg"
                      disabled={disabled}
                      onChange={(weightKg) => setValues((v) => ({ ...v, weightKg }))}
                    />
                    <Stepper
                      label="Wiederholungen"
                      value={values.reps}
                      step={1}
                      min={1}
                      disabled={disabled}
                      onChange={(reps) => setValues((v) => ({ ...v, reps }))}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-small text-text-subtle">RIR</span>
                    <SegmentedControl
                      label="Wiederholungen in Reserve"
                      value={values.rir === null ? "" : String(values.rir)}
                      onChange={(v) => setValues((cur) => ({ ...cur, rir: Number(v) }))}
                      options={[
                        { value: "0", label: "0" },
                        { value: "1", label: "1" },
                        { value: "2", label: "2" },
                        { value: "3", label: "3+" },
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="dashed"
          iconLeft={<Plus size={16} aria-hidden />}
          disabled={setCount >= 20}
          onClick={() => onSetCountChange(setCount + 1)}
        >
          Satz
        </Button>
        <Button
          variant="dashed"
          iconLeft={<Link2 size={16} aria-hidden />}
          aria-pressed={supersetActive}
          className={cn(supersetActive && "border-accent-border text-accent")}
          onClick={onToggleSuperset}
        >
          Supersatz
        </Button>
        {setCount > Math.max(1, done.length) && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onSetCountChange(setCount - 1)}>
            Letzten Satz entfernen
          </Button>
        )}
      </div>

      {complete && (
        <p className="mt-3 text-small text-accent">Alle Sätze erledigt.</p>
      )}
    </Card>
  );
}
