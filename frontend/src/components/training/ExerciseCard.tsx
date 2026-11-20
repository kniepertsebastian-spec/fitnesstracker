import { muscleLabel } from "../../lib/exerciseLabels";
import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, Link2, Pause, Play, Plus, Repeat2, TrendingDown } from "lucide-react";
import { SET_SCHEME_INFO, TECHNIQUE_INFO, type ExerciseDto, type PlanDiaryExerciseDto, type Technique, type TrainingPhase } from "@fitnesstracker/shared";
import { segmentReps } from "../../lib/trainingGroups";
import { TechniqueInfoButton } from "./TechniqueInfoButton";
import type { LocalWorkoutLog } from "../../offline/db";
import { formatKg, formatLastTime } from "../../lib/trainingSets";
import { DEFAULT_BAR_KG, platesPerSide } from "../../lib/plates";
import { warmupSets } from "../../lib/warmup";
import { KcalEstimate } from "../workoutLog/KcalEstimate";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Badge, Button, Card, Input, Select, SegmentedControl, SetCheck, Stepper, cn } from "../ui";
import type { SetCheckState } from "../ui";
import { formatPrescription } from "../../lib/planPrescription";

const PROGRESSION_LABEL: Record<TrainingPhase, string> = {
  AUFBAU: "Gewicht steigern",
  MUSKELAUSDAUER: "Wdh. steigern",
  NEGATIV: "langsam ablassen",
  DAILY: "Tägliche Routine",
  CUSTOM_1: "Gewicht steigern",
  CUSTOM_2: "Gewicht steigern",
  CUSTOM_3: "Gewicht steigern",
  CUSTOM_4: "Gewicht steigern",
  CUSTOM_5: "Gewicht steigern",
};

export interface SetValues {
  weightKg: number;
  reps: number;
  rir: number | null;
  note: string | null;
  // Timed sets: the seconds held (reps is then 1).
  durationSeconds?: number | null;
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
  // Technique of the active group ("Supersatz", "Riesensatz", ...) and the other exercises in it.
  groupLabel: string | null;
  groupWith: string[];
  // Set on the exercise the superset was started on: the partner can be changed from there.
  supersetPartnerId: string | null;
  supersetPartnerOptions: { id: string; name: string }[];
  onSupersetPartnerChange: (partnerId: string) => void;
  // A run of mini sets (drop set, rest-pause, myo-reps) that is under way on this exercise.
  segment: { technique: Technique | null; factor: number } | null;
  // The plan has such a technique for this exercise: offered at the last working set.
  segmentOffer: { technique: Technique; label: string; extraSets: number } | null;
  onStartSegment: () => void;
  onToggleDropset: () => void;
  // Starts the short pause inside a cluster set.
  onMiniRest: () => void;
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


const roundTo = (kg: number, step = 2.5) => Math.max(0, Math.round(kg / step) * step);

// The weight a per-set prescription (pyramid) is a share of: this week's suggestion, else the start weight,
// else the heaviest of last time.
function topWeight(entry: PlanDiaryExerciseDto, previous: LocalWorkoutLog[]): number {
  return entry.progression?.suggestedWeightKg ?? entry.startWeightKg ?? Math.max(0, ...previous.map((l) => l.weightKg));
}

function initialValues(
  entry: PlanDiaryExerciseDto,
  done: LocalWorkoutLog[],
  previous: LocalWorkoutLog[],
  segment: { technique: Technique | null; factor: number } | null = null,
): SetValues {
  const last = done.at(-1);
  // Mini sets of a run follow the previous set: a drop set lowers the weight, rest-pause and myo-reps keep it
  // and cut the reps.
  if (last && segment) {
    return {
      weightKg: segment.factor === 1 ? last.weightKg : roundTo(last.weightKg * segment.factor),
      reps: segmentReps(segment.technique, last.reps),
      rir: null,
      note: null,
    };
  }
  // A pyramid or timed prescription says what the next set should be.
  const planned = entry.setPlan?.[done.length];
  if (planned) {
    const base = topWeight(entry, previous);
    return {
      weightKg: planned.weightPct && base > 0 ? roundTo((base * planned.weightPct) / 100) : (last?.weightKg ?? base),
      reps: planned.seconds ? 1 : (planned.reps ?? last?.reps ?? entry.targetReps ?? 10),
      durationSeconds: planned.seconds ?? null,
      rir: null,
      note: null,
    };
  }
  if (last) {
    return { weightKg: last.weightKg, reps: last.reps, rir: null, note: null };
  }
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

// Countdown for a timed set: the seconds to hold, with a stop button. The result is entered by hand, this is
// only the clock.
function HoldTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      navigator.vibrate?.([200, 100, 200]);
      setRemaining(null);
      return;
    }
    const id = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);
  return remaining === null ? (
    <Button size="sm" variant="secondary" iconLeft={<Play size={14} aria-hidden />} onClick={() => setRemaining(seconds)}>
      {seconds} s halten
    </Button>
  ) : (
    <Button size="sm" variant="primary" iconLeft={<Pause size={14} aria-hidden />} onClick={() => setRemaining(null)} aria-live="off">
      {remaining} s · Stopp
    </Button>
  );
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
  groupLabel,
  groupWith,
  supersetPartnerId,
  supersetPartnerOptions,
  onSupersetPartnerChange,
  segment,
  segmentOffer,
  onStartSegment,
  onToggleDropset,
  onMiniRest,
  onSetCountChange,
  onLogSet,
  onUndoSet,
  onToggleSuperset,
  onOpenTechnique,
  onSwap,
}: Props) {
  const [values, setValues] = useState<SetValues>(() => initialValues(entry, done, previous, segment));
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
    setValues(initialValues(entry, done, previous, segment));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done.length, entry.id, segment?.technique]);

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
  // Techniques that change how the reps are done (no extra sets, no other exercise): shown as an instruction.
  const cueTechnique =
    entry.technique && TECHNIQUE_INFO[entry.technique].kind === "cue" && entry.technique !== "ISOMETRIC" ? entry.technique : null;
  const timed = entry.setScheme === "TIME_BASED";
  const p = entry.progression;
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
            {muscleLabel(m)}
          </Badge>
        ))}
        <Badge tone="accent">{PROGRESSION_LABEL[phase]}</Badge>
        {entry.technique && (
          <span className="flex items-center">
            <Badge tone="magenta">{TECHNIQUE_INFO[entry.technique].label}</Badge>
            <TechniqueInfoButton subject={{ kind: "technique", id: entry.technique }} />
          </span>
        )}
        {entry.setScheme && entry.setScheme !== "STRAIGHT" && (
          <span className="flex items-center">
            <Badge tone="info">{SET_SCHEME_INFO[entry.setScheme].label}</Badge>
            <TechniqueInfoButton subject={{ kind: "scheme", id: entry.setScheme }} />
          </span>
        )}
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
            <dd className="tabular font-numeric text-text-2">{formatPrescription(entry)}</dd>
          </div>
        )}
        <div className="flex gap-1.5">
          <dt className="text-text-subtle">Letztes Mal</dt>
          <dd className="tabular font-numeric text-text-2">
            {formatLastTime(previous)}
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
            <dd className="tabular font-numeric text-accent-text">
              {p.mode === "weight" ? `${formatKg(p.suggestedWeightKg)} kg` : `${p.suggestedReps} Wdh.`}
            </dd>
          </div>
        )}
      </dl>
      {entry.notes && <p className="mt-2 text-small text-text-subtle">{entry.notes}</p>}
      {cueTechnique && (
        <div className="mt-2 rounded-lg bg-surface-2 p-3 text-small text-text-2">
          <p>
            <strong className="text-text">{TECHNIQUE_INFO[cueTechnique].label}:</strong> {TECHNIQUE_INFO[cueTechnique].how}
          </p>
          {cueTechnique === "CLUSTER" && (
            <Button className="mt-2" size="sm" variant="secondary" iconLeft={<Pause size={14} aria-hidden />} onClick={onMiniRest}>
              Mini-Pause 20 s
            </Button>
          )}
        </div>
      )}

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
                    <span className="tabular font-numeric text-body text-text">
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
        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_3rem] items-center gap-2 px-1 pb-2 text-overline text-text-faint">
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
          const shownReps = timed ? `${log ? (log.durationSeconds ?? "–") : (values.durationSeconds ?? entry.setPlan?.[i]?.seconds ?? "–")} s` : String(log ? log.reps : values.reps);
          const target = entry.setPlan?.[i];
          return (
            <div key={i} className="border-t border-border-subtle py-2 first:border-t-0">
              <div className="grid grid-cols-[2rem_1fr_1fr_1fr_3rem] items-center gap-2 px-1">
                <span className="tabular font-numeric text-small text-text-subtle">{i + 1}</span>
                <span className="tabular font-numeric text-small text-text-faint">
                  {prev ? `${formatKg(prev.weightKg)} × ${prev.reps}` : "–"}
                </span>
                <span
                  className={cn(
                    "tabular font-numeric text-set-value",
                    state === "open" ? "text-text-faint" : "text-text",
                  )}
                >
                  {formatKg(shownKg)}
                </span>
                <span
                  className={cn(
                    "tabular font-numeric text-set-value",
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

              {target && state !== "done" && (
                <p className="mt-1 px-1 text-xs text-text-subtle">
                  Ziel: {target.seconds ? `${target.seconds} s halten` : `${target.reps ?? "?"} Wdh.`}
                  {target.weightPct ? ` · ${target.weightPct} % des schwersten Satzes` : ""}
                </p>
              )}

              {log?.note && <p className="mt-1 px-1 text-small text-text-subtle">{log.note}</p>}

              {state === "current" && p && (
                <p className="mt-2 flex items-center gap-1 px-1 text-small text-accent-text">
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
                    {timed ? (
                      <Stepper
                        label="Dauer"
                        value={values.durationSeconds ?? entry.setPlan?.[i]?.seconds ?? 30}
                        step={5}
                        min={5}
                        unit="s"
                        disabled={disabled}
                        onChange={(durationSeconds) => setValues((v) => ({ ...v, durationSeconds, reps: 1 }))}
                      />
                    ) : (
                      <Stepper
                        label="Wiederholungen"
                        value={values.reps}
                        step={1}
                        min={1}
                        disabled={disabled}
                        onChange={(reps) => setValues((v) => ({ ...v, reps }))}
                      />
                    )}
                  </div>
                  {timed && <HoldTimer seconds={values.durationSeconds ?? entry.setPlan?.[i]?.seconds ?? 30} />}
                  {plateLoad && (
                    <p className="flex flex-wrap items-center gap-x-1 text-small text-text-subtle">
                      Pro Seite:{" "}
                      <span className="tabular font-numeric text-text-2">
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
        {/* Variant swap instead of extra classes: cn() does not merge, so appended border/text
            colors lost against the dashed variant's own and the active state did not show. */}
        <Button
          variant={supersetActive ? "selected" : "dashed"}
          iconLeft={<Link2 size={16} aria-hidden />}
          aria-pressed={supersetActive}
          onClick={onToggleSuperset}
        >
          {supersetActive ? "Supersatz aktiv" : "Supersatz"}
        </Button>
        <Button
          variant={segment?.technique === "DROPSET" ? "selected" : "dashed"}
          iconLeft={<TrendingDown size={16} aria-hidden />}
          aria-pressed={segment?.technique === "DROPSET"}
          onClick={onToggleDropset}
        >
          {segment?.technique === "DROPSET" ? "Dropsatz aktiv" : "Dropsatz"}
        </Button>
        {setCount > Math.max(1, done.length) && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onSetCountChange(setCount - 1)}>
            Letzten Satz entfernen
          </Button>
        )}
      </div>

      {supersetActive && groupLabel && groupWith.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-small text-text-2">
          <p>
            {groupLabel} mit <strong className="text-text">{groupWith.join(", ")}</strong>: nach jedem Satz wechselst du die
            Übung, die Pause kommt erst nach der Runde.
          </p>
          {supersetPartnerId !== null && (
            <label className="mt-2 block text-xs text-text-subtle">
              Partner
              <Select
                value={supersetPartnerId}
                onChange={(e) => onSupersetPartnerChange(e.target.value)}
                className="mt-1"
              >
                {!supersetPartnerOptions.some((o) => o.id === supersetPartnerId) && (
                  <option value={supersetPartnerId}>{groupWith[0]}</option>
                )}
                {supersetPartnerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
        </div>
      )}
      {segmentOffer && done.length === setCount - 1 && (
        <div className="mt-3 rounded-xl border border-accent-border bg-accent-soft p-3 text-small text-text-2">
          <p>
            <strong className="text-text">{segmentOffer.label}</strong> ist für diese Übung vorgesehen: beim letzten Satz{" "}
            {segmentOffer.extraSets} Mini-Sätze anhängen.
          </p>
          <div className="mt-2 flex items-center gap-1">
            <Button size="sm" variant="primary" onClick={onStartSegment}>
              {segmentOffer.label} starten
            </Button>
            <TechniqueInfoButton subject={{ kind: "technique", id: segmentOffer.technique }} />
          </div>
        </div>
      )}
      {segment && (
        <p className="mt-3 rounded-xl border border-border bg-surface-2 p-3 text-small text-text-2">
          {segment.technique ? TECHNIQUE_INFO[segment.technique].label : "Dropsatz"}: nach jedem Mini-Satz kurze Pause
          {segment.factor < 1 ? `, das Gewicht wird mit etwa −${Math.round((1 - segment.factor) * 100)} % vorgeschlagen` : ", gleiches Gewicht, weniger Wiederholungen"}.
          Mit „Satz“ hängst du eine weitere Stufe an.
        </p>
      )}

      {done.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 text-small">
          {complete && <span className="text-accent-text">Alle Sätze erledigt.</span>}
          <KcalEstimate sets={done} />
        </p>
      )}
    </Card>
  );
}
