import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Link2, Plus, Repeat2 } from "lucide-react";
import type { ExerciseDto, PlanDiaryExerciseDto, TrainingPhase } from "@fitnesstracker/shared";
import type { LocalWorkoutLog } from "../../offline/db";
import { formatKg } from "../../lib/trainingSets";
import { DEFAULT_BAR_KG, platesPerSide } from "../../lib/plates";
import { warmupSets } from "../../lib/warmup";
import { KcalEstimate } from "../workoutLog/KcalEstimate";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Badge, Button, Card, Input, SegmentedControl, SetCheck, Stepper, cn } from "../ui";
import type { SetCheckState } from "../ui";
import { formatPrescription } from "../../lib/planPrescription";

const PROGRESSION_LABEL: Record<TrainingPhase, string> = {
  AUFBAU: "Gewicht steigern",
  MUSKELAUSDAUER: "Wdh. steigern",
  NEGATIV: "langsam ablassen",
};

export interface SetValues {
  weightKg: number;
  reps: number;
  rir: number | null;
  note: string | null;
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
  onSwap: () => void;
}

function progressionHint(p: NonNullable<PlanDiaryExerciseDto["progression"]>): string {
  const delta =
    p.mode === "weight"
      ? p.suggestedWeightKg - p.lastWeightKg
      : p.suggestedReps - p.lastReps;
  const sign = delta > 0 ? "+" : "";
  const unit = p.mode === "weight" ? "" : " Wdh.";
  const change = delta === 0 ? "" : ` (${sign}${String(delta).replace(".", ",")}${unit})`;
  return `Heute: ${formatKg(p.suggestedWeightKg)} kg × ${p.suggestedReps}${change}${p.deloadSuggested ? " · Deload" : ""}`;
}

const STEP_OPTIONS = ["2.5", "5"] as const;

function stepKey(exerciseName: string): string {
  return `weightStep:${exerciseName}`;
}

function loadStep(exerciseName: string): number {
  try {
    return localStorage.getItem(stepKey(exerciseName)) === "5" ? 5 : 2.5;
  } catch {
    return 2.5;
  }
}

function initialValues(entry: PlanDiaryExerciseDto, done: LocalWorkoutLog[], previous: LocalWorkoutLog[]): SetValues {
  const last = done.at(-1);
  if (last) return { weightKg: last.weightKg, reps: last.reps, rir: null, note: null };
  const p = entry.progression;
  const prev = previous[0];
  return {
    weightKg: p ? p.suggestedWeightKg : (prev?.weightKg ?? entry.startWeightKg ?? 0),
    reps: p ? p.suggestedReps : (entry.targetReps ?? prev?.reps ?? 10),
    rir: null,
    note: null,
  };
}

// Which warm-up sets were ticked off, per plan entry. Module-level so swiping to another exercise and
// back keeps them for the rest of the visit; deliberately not persisted (warm-ups are never logged).
const doneWarmups = new Map<string, boolean[]>();

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
  onSwap,
}: Props) {
  const [values, setValues] = useState<SetValues>(() => initialValues(entry, done, previous));
  const [weightStep, setWeightStep] = useState(() => loadStep(entry.exerciseName));

  useEffect(() => {
    setWeightStep(loadStep(entry.exerciseName));
  }, [entry.exerciseName]);

  const changeStep = (next: string) => {
    const step = Number(next);
    setWeightStep(step);
    try {
      localStorage.setItem(stepKey(entry.exerciseName), String(step));
    } catch {
      // Remembering the step is a convenience; ignore blocked storage.
    }
  };

  // After a set is logged (or undone) the next one starts from the last logged values.
  useEffect(() => {
    setValues(initialValues(entry, done, previous));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.length, entry.id]);

  const [warmupOpen, setWarmupOpen] = useState(false);
  const [, rerender] = useState(0);
  const toggleWarmup = (entryId: string, index: number) => {
    const ticks = [...(doneWarmups.get(entryId) ?? [])];
    ticks[index] = !ticks[index];
    doneWarmups.set(entryId, ticks);
    rerender((n) => n + 1);
  };

  const currentIndex = done.length;
  const complete = done.length >= setCount;
  const p = entry.progression;
  const lastTime = previous[0];
  // The most recent note from the last time this exercise was trained, e.g. the seat setting.
  const lastNote = previous.find((log) => log.note)?.note ?? null;
  const isBarbell = exercise?.equipment?.toLowerCase() === "barbell";
  // Offered before the first working set only, based on the weight that is about to be lifted.
  const warmups = done.length === 0 ? warmupSets(values.weightKg, isBarbell ? DEFAULT_BAR_KG : 0) : [];
  const warmupTicks = doneWarmups.get(entry.id) ?? [];
  const plateLoad = isBarbell ? platesPerSide(values.weightKg) : null;

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
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
          <Button size="sm" variant="ghost" iconLeft={<Repeat2 size={16} aria-hidden />} onClick={onSwap}>
            Tauschen
          </Button>
          <Button size="sm" variant="ghost" iconLeft={<BookOpen size={16} aria-hidden />} onClick={onOpenTechnique}>
            Technik
          </Button>
        </div>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-small">
        {(entry.repRangeMax !== null || entry.restSeconds !== null) && (
          <div className="flex gap-1.5">
            <dt className="text-text-subtle">Ziel</dt>
            <dd className="tabular font-mono text-text-2">{formatPrescription(entry)}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt className="text-text-subtle">Letztes Mal</dt>
          <dd className="tabular font-mono text-text-2">
            {lastTime ? `${previous.length} × ${lastTime.reps} · ${formatKg(lastTime.weightKg)} kg` : "–"}
          </dd>
        </div>
        {lastNote && (
          <div className="flex gap-1.5">
            <dt className="text-text-subtle">Notiz</dt>
            <dd className="text-text-2">{lastNote}</dd>
          </div>
        )}
        {p && (
          <div className="flex gap-1.5">
            <dt className="text-text-subtle">Vorschlag</dt>
            <dd className="tabular font-mono text-accent">
              {p.mode === "weight" ? `${formatKg(p.suggestedWeightKg)} kg` : `${p.suggestedReps} Wdh.`}
            </dd>
          </div>
        )}
      </dl>
      {entry.notes && <p className="mt-2 text-small text-text-subtle">{entry.notes}</p>}

      {warmups.length > 0 && (
        <div className="mt-4 rounded-lg bg-surface-2">
          <div className="flex items-center pr-1">
            <button
              type="button"
              aria-expanded={warmupOpen}
              onClick={() => setWarmupOpen((open) => !open)}
              className="flex min-h-11 flex-1 items-center justify-between gap-2 px-3 text-left text-small font-medium text-text-muted"
            >
              <span>
                Aufwärmen · {warmupTicks.filter(Boolean).length} von {warmups.length}
              </span>
              <ChevronDown size={16} aria-hidden className={cn("transition-transform", warmupOpen && "rotate-180")} />
            </button>
            <CalcInfoButton id="warmup" />
          </div>
          {warmupOpen && (
            <ul className="px-3 pb-3">
              {warmups.map((set, i) => (
                <li key={set.percent} className="border-t border-border-subtle first:border-t-0">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-accent"
                      checked={!!warmupTicks[i]}
                      disabled={disabled}
                      onChange={() => toggleWarmup(entry.id, i)}
                    />
                    <span className="tabular font-mono text-body text-text">
                      {formatKg(set.weightKg)} kg × {set.reps}
                    </span>
                    <span className="text-small text-text-subtle">{set.percent} %</span>
                  </label>
                </li>
              ))}
              <li className="pt-1 text-small text-text-faint">Wird nicht protokolliert und zählt nicht zum Volumen.</li>
            </ul>
          )}
        </div>
      )}

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

              {log?.note && <p className="mt-1 px-1 text-small text-text-subtle">{log.note}</p>}

              {state === "current" && p && (
                <p className="mt-2 flex items-center gap-1 px-1 text-small text-accent">
                  {progressionHint(p)}
                  <CalcInfoButton id="progression" />
                </p>
              )}

              {state === "current" && (
                <div className="mt-3 flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Stepper
                      label="Gewicht"
                      value={values.weightKg}
                      step={weightStep}
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
                  {plateLoad && (
                    <p className="flex flex-wrap items-center gap-x-1 text-small text-text-subtle">
                      Pro Seite:{" "}
                      <span className="tabular font-mono text-text-2">
                        {plateLoad.plates.length > 0
                          ? plateLoad.plates.map((plate) => formatKg(plate)).join(" + ")
                          : "nur die Stange"}
                      </span>{" "}
                      (Stange {DEFAULT_BAR_KG} kg
                      {plateLoad.remainderKg > 0 && `, ${formatKg(plateLoad.remainderKg)} kg pro Seite nicht belegbar`})
                      <CalcInfoButton id="plates" />
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center text-small text-text-subtle">
                      RIR <CalcInfoButton id="term-rir" />
                    </span>
                    <SegmentedControl
                      label="Wiederholungen in Reserve"
                      value={values.rir === null ? "" : String(values.rir)}
                      onChange={(v) => setValues((cur) => ({ ...cur, rir: Number(v) }))}
                      options={[
                        { value: "0", label: "0" },
                        { value: "1", label: "1" },
                        { value: "2", label: "2" },
                        { value: "3", label: "3" },
                        { value: "4", label: "4" },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-small text-text-subtle">Schrittweite</span>
                    <SegmentedControl
                      label="Gewichts-Schrittweite"
                      value={String(weightStep)}
                      onChange={changeStep}
                      options={STEP_OPTIONS.map((v) => ({ value: v, label: `${v.replace(".", ",")} kg` }))}
                    />
                  </div>
                  <Input
                    aria-label="Notiz zum Satz"
                    placeholder="Notiz (z. B. Sitz 4, Schulter zwickt)"
                    maxLength={500}
                    value={values.note ?? ""}
                    disabled={disabled}
                    onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
                  />
                  <Button
                    size="lg"
                    className="h-16 w-full text-body font-semibold"
                    disabled={disabled || busy}
                    onClick={() => onLogSet(values, i + 1)}
                  >
                    Satz {i + 1} speichern
                  </Button>
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

      {done.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 text-small">
          {complete && <span className="text-accent">Alle Sätze erledigt.</span>}
          <KcalEstimate sets={done} />
        </p>
      )}
    </Card>
  );
}
