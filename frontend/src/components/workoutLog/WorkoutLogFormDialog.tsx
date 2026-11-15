import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { Minus, Plus } from "lucide-react";
import { z } from "zod";
import type { ExerciseDto } from "@fitnesstracker/shared";
import type { LocalWorkoutLog } from "../../offline/db";
import { useCreateWorkoutLog, useExercises, useUpdateWorkoutLog, useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { useTimerStore } from "../../stores/timerStore";
import { usePRToastStore } from "../../stores/prToastStore";
import { buildWarmupPyramid } from "../../lib/oneRepMax";
import { detectPRs, prLabels } from "../../lib/prDetection";
import { Button, Callout, Dialog, Field, IconButton, Input, SegmentedControl, Select } from "../ui";
import { formatKg } from "../../lib/trainingSets";
import {
  localDateInputValue,
  localDateTimeToIso,
  localTimeInputValue,
  localYesterdayInputValue,
  utcDayKey,
} from "../../lib/dates";

const formSchema = z.object({
  exerciseId: z.string().uuid({ message: "Bitte eine Übung wählen" }),
  setNumber: z.coerce.number().int().positive(),
  reps: z.coerce.number().int().positive(),
  weightKg: z.coerce.number().nonnegative(),
  rir: z.union([z.coerce.number().int().min(0).max(10), z.literal("")]).optional(),
  note: z.string().max(500, { message: "Höchstens 500 Zeichen" }).optional(),
});
type FormValues = z.infer<typeof formSchema>;
// zod 4 types coerced/preprocessed fields as `unknown` on the input side, which is what the form
// holds before validation; handleSubmit hands the validated output (FormValues) to the callback.
type FormInput = z.input<typeof formSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingLog: LocalWorkoutLog | null;
  /** "YYYY-MM-DD" (lokal): öffnet den Dialog direkt im Nachtragen-Modus für diesen Tag. */
  initialDate?: string | null;
}

// Uhrzeit, die beim Nachtragen für einen vergangenen Tag vorgeschlagen wird — ein Satz "um
// irgendwann am Abend" ist näher an der Wahrheit als eine Mitternachts-Uhrzeit.
const DEFAULT_BACKDATE_TIME = "18:00";

type WhenChoice = "now" | "yesterday" | "custom";

// Remembered for the lifetime of the tab (module-level, not persisted) so "add to last group"
// works across dialog opens within one session without needing a new data model just to track
// "what superset was I just building" — reloading the page starts a fresh session, which is fine.
let lastSupersetGroupId: string | null = null;

type SupersetMode = "none" | "new" | "join";

// +/- stepper alongside the number input — the roadmap's "schnelle Gewichts-/Rep-Anpassung" ask:
// a big tap target beats opening the on-screen keyboard for a ±1 rep or ±2.5kg change mid-set.
function SteppedNumberField({
  label,
  value,
  onChange,
  step,
  min = 0,
  inputProps,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
  min?: number;
  inputProps: UseFormRegisterReturn;
}) {
  const round = (n: number) => Math.round(n * 10) / 10;
  return (
    <Field label={label}>
      {(p) => (
        <div className="flex items-center gap-2">
          <IconButton
            className="h-12 w-12"
            onClick={() => onChange(Math.max(min, round((Number(value) || 0) - step)))}
            aria-label={`${label} verringern`}
          >
            <Minus size={18} aria-hidden />
          </IconButton>
          <Input
            {...p}
            type="number"
            // `step="any"` — a native step-mismatch would otherwise silently block submission
            // (no JS handler runs, no console error) whenever the value carries more precision
            // than the browser's default whole-number step, which the +/- buttons intentionally
            // produce for weight (2.5kg increments).
            step="any"
            className="h-12 text-center font-numeric"
            {...inputProps}
          />
          <IconButton
            className="h-12 w-12"
            onClick={() => onChange(round((Number(value) || 0) + step))}
            aria-label={`${label} erhöhen`}
          >
            <Plus size={18} aria-hidden />
          </IconButton>
        </div>
      )}
    </Field>
  );
}

export function WorkoutLogFormDialog({ open, onClose, editingLog, initialDate = null }: Props) {
  const { data: exercises } = useExercises();
  const { data: allLogs } = useWorkoutLogs();
  const createLog = useCreateWorkoutLog();
  const updateLog = useUpdateWorkoutLog();
  const { autoStartEnabled, autoStartSeconds, start: startRestTimer } = useTimerStore();
  const showPR = usePRToastStore((s) => s.showPR);
  const [supersetMode, setSupersetMode] = useState<SupersetMode>("none");
  const [showWarmup, setShowWarmup] = useState(false);
  // Counts sets saved in this dialog "session" (between opens) — drives the "Fertig" vs.
  // "Abbrechen" close-button label and lets the dialog stay open across consecutive sets instead
  // of forcing reopen-reselect-exercise for every single set of a workout.
  const [savedCount, setSavedCount] = useState(0);
  // "Wann?": by default a set is stamped "jetzt"; with `backdate` the user picks date + time
  // (Training nachtragen, or correcting the time of an existing set). Plain state instead of
  // react-hook-form fields: the choice drives the dialog title, rest timer and set numbering.
  const [backdate, setBackdate] = useState(false);
  const [dateValue, setDateValue] = useState(() => localDateInputValue());
  const [timeValue, setTimeValue] = useState(() => localTimeInputValue());
  const [whenError, setWhenError] = useState<string | null>(null);
  const originalWhen = useRef<{ date: string; time: string } | null>(null);
  const previousExerciseId = useRef<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(formSchema) });

  const watchedWeight = watch("weightKg");
  const watchedReps = watch("reps");
  const watchedExerciseId = watch("exerciseId");

  useEffect(() => {
    const today = localDateInputValue();
    setWhenError(null);
    previousExerciseId.current = undefined;
    if (editingLog) {
      const performed = new Date(editingLog.performedAt);
      const parts = { date: localDateInputValue(performed), time: localTimeInputValue(performed) };
      originalWhen.current = parts;
      setBackdate(true);
      setDateValue(parts.date);
      setTimeValue(parts.time);
      reset({
        exerciseId: editingLog.exerciseId,
        setNumber: editingLog.setNumber,
        reps: editingLog.reps,
        weightKg: editingLog.weightKg,
        rir: editingLog.rir ?? "",
        note: editingLog.note ?? "",
      });
      setSupersetMode(editingLog.supersetGroupId ? "join" : "none");
    } else {
      reset({ exerciseId: undefined, setNumber: 1, reps: 10, weightKg: 0, rir: "", note: "" });
      setSupersetMode("none");
      originalWhen.current = null;
      if (initialDate && initialDate < today) {
        setBackdate(true);
        setDateValue(initialDate);
        setTimeValue(DEFAULT_BACKDATE_TIME);
      } else {
        setBackdate(false);
        setDateValue(today);
        setTimeValue(localTimeInputValue());
      }
    }
    setShowWarmup(false);
    setSavedCount(0);
  }, [editingLog, reset, open, initialDate]);

  // The instant this set will be stamped with, for the live preview of the chosen day (set
  // numbering). Null while the date/time inputs are incomplete.
  const chosenIso = backdate ? localDateTimeToIso(dateValue, timeValue) : new Date().toISOString();
  const chosenDayKey = chosenIso ? utcDayKey(new Date(chosenIso)) : null;
  const whenChoice: WhenChoice = !backdate ? "now" : dateValue === localYesterdayInputValue() ? "yesterday" : "custom";

  const chooseWhen = (choice: WhenChoice) => {
    setWhenError(null);
    if (choice === "now") {
      setBackdate(false);
      return;
    }
    if (!backdate) setTimeValue(choice === "yesterday" ? DEFAULT_BACKDATE_TIME : localTimeInputValue());
    setBackdate(true);
    if (choice === "yesterday") setDateValue(localYesterdayInputValue());
  };

  // Prefills reps/weight from the last time this exercise was logged, and sets the set number to
  // "however many sets of this exercise are already logged on the chosen day, plus one" — the
  // roadmap's "letzte Werte sinnvoll vorausfüllen" ask. Reps/weight only when picking a *new*
  // exercise (not on every keystroke), the set number also when the day changes; never in edit
  // mode, where the existing values are the point.
  useEffect(() => {
    if (editingLog || !watchedExerciseId || !allLogs) return;
    if (previousExerciseId.current !== watchedExerciseId) {
      const lastLog = allLogs.find((log) => log.exerciseId === watchedExerciseId);
      if (lastLog) {
        setValue("weightKg", lastLog.weightKg);
        setValue("reps", lastLog.reps);
      }
      previousExerciseId.current = watchedExerciseId;
    }
    if (chosenDayKey) {
      const setsOnDay = allLogs.filter(
        (log) => log.exerciseId === watchedExerciseId && utcDayKey(new Date(log.performedAt)) === chosenDayKey,
      ).length;
      setValue("setNumber", setsOnDay + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedExerciseId, chosenDayKey]);

  const lastLogForExercise = !editingLog
    ? allLogs?.find((log) => log.exerciseId === watchedExerciseId)
    : undefined;

  const resolveSupersetGroupId = (): string | null | undefined => {
    if (editingLog) {
      // Editing never changes an existing set's grouping — that's a deliberate, separate action
      // a user hasn't been asked for here, not a side effect of fixing a typo in the weight.
      return undefined;
    }
    if (supersetMode === "new") {
      lastSupersetGroupId = crypto.randomUUID();
      return lastSupersetGroupId;
    }
    if (supersetMode === "join") {
      return lastSupersetGroupId;
    }
    return null;
  };

  const onSubmit = async (data: FormValues) => {
    const exerciseName = exercises?.find((e) => e.id === data.exerciseId)?.name ?? "";
    const rir = data.rir === "" || data.rir === undefined ? null : data.rir;
    const note = data.note?.trim() || null;
    const supersetGroupId = resolveSupersetGroupId();

    // Validated before anything is written, so an invalid time never half-saves a set.
    let performedAtOverride: string | undefined;
    if (backdate) {
      const iso = localDateTimeToIso(dateValue, timeValue);
      if (!iso) {
        setWhenError("Bitte Datum und Uhrzeit angeben.");
        return;
      }
      if (new Date(iso).getTime() > Date.now()) {
        setWhenError("Der Zeitpunkt liegt in der Zukunft.");
        return;
      }
      // Editing only sends the time when the user actually changed it, so fixing a typo in the
      // weight never rewrites the original timestamp (it has seconds; the inputs only minutes).
      const original = originalWhen.current;
      if (!editingLog || !original || original.date !== dateValue || original.time !== timeValue) {
        performedAtOverride = iso;
      }
    }
    setWhenError(null);

    if (editingLog) {
      await updateLog.mutateAsync({
        clientId: editingLog.clientId,
        input: { ...data, rir, note, ...(performedAtOverride ? { performedAt: performedAtOverride } : {}) },
        exerciseName,
      });
      onClose();
      return;
    }

    // Captured before the create call — once it resolves, allLogs (the react-query cache) has
    // already absorbed the new set, which would make it compare against itself.
    const performedAt = performedAtOverride ?? new Date().toISOString();
    const prs = detectPRs(allLogs ?? [], data.exerciseId, [
      { reps: data.reps, weightKg: data.weightKg, performedAt },
    ]);

    await createLog.mutateAsync({
      input: {
        ...data,
        rir,
        note,
        supersetGroupId,
        clientId: crypto.randomUUID(),
        ...(performedAtOverride ? { performedAt: performedAtOverride } : {}),
      },
      exerciseName,
    });
    if (prLabels(prs).length > 0) {
      showPR(exerciseName, prLabels(prs));
    }
    // Only a newly logged set starts the rest timer — editing a past entry (e.g. fixing a
    // typo) isn't "I just finished a set", and neither is a set entered after the fact, so
    // neither should interrupt whatever timer is already running (or start one out of nowhere).
    if (autoStartEnabled && !backdate) {
      startRestTimer(autoStartSeconds);
    }
    // A "Neue Gruppe" tap only starts a group once — the next quick set for the same exercise
    // should join it, not spin up a second group.
    if (supersetMode === "new") {
      setSupersetMode("join");
    }
    setSavedCount((c) => c + 1);
    // Stays open on the same exercise with the set number bumped — logging a straight set of 3-4
    // sets is then select-exercise-once, then Speichern repeatedly, instead of reopening and
    // reselecting the exercise for every single set (the roadmap's "möglichst wenige
    // Interaktionen" / "Sets schnell hinzufügen" ask).
    reset({ ...data, setNumber: data.setNumber + 1 });
  };

  const warmupSteps = buildWarmupPyramid(Number(watchedWeight) || 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editingLog ? "Satz bearbeiten" : backdate ? "Satz nachtragen" : "Satz hinzufügen"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {!editingLog && (
            <div className="flex flex-col gap-1.5">
              <span className="text-small font-medium text-text-muted">Wann?</span>
              <SegmentedControl
                label="Zeitpunkt des Satzes"
                value={whenChoice}
                onChange={chooseWhen}
                options={[
                  { value: "now", label: "Jetzt" },
                  { value: "yesterday", label: "Gestern" },
                  { value: "custom", label: "Anderes Datum" },
                ]}
              />
            </div>
          )}
          {backdate && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Datum" error={whenError}>
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    className="h-12"
                    // No `max`: a native max would block submission silently (no JS handler, no
                    // message); the explicit "liegt in der Zukunft" check in onSubmit explains it.
                    value={dateValue}
                    onChange={(e) => {
                      setWhenError(null);
                      setDateValue(e.target.value);
                    }}
                  />
                )}
              </Field>
              <Field label="Uhrzeit">
                {(p) => (
                  <Input
                    {...p}
                    type="time"
                    className="h-12"
                    value={timeValue}
                    onChange={(e) => {
                      setWhenError(null);
                      setTimeValue(e.target.value);
                    }}
                  />
                )}
              </Field>
            </div>
          )}
        </div>

        <Field
          label="Übung"
          error={errors.exerciseId?.message}
          hint={
            lastLogForExercise
              ? `Zuletzt: ${lastLogForExercise.reps} Wdh. × ${formatKg(lastLogForExercise.weightKg)} kg`
              : undefined
          }
        >
          {(p) => (
            <Select {...p} {...register("exerciseId")} defaultValue="">
              <option value="" disabled>
                Übung wählen…
              </option>
              {exercises?.map((exercise: ExerciseDto) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Satz">{(p) => <Input {...p} type="number" {...register("setNumber")} />}</Field>
          <Field label="RIR" error={errors.rir?.message}>
            {(p) => <Input {...p} type="number" min={0} max={10} placeholder="–" {...register("rir")} />}
          </Field>
        </div>

        <Field label="Notiz (optional)" error={errors.note?.message}>
          {(p) => <Input {...p} type="text" maxLength={500} placeholder="z. B. Sitz 4, Schulter zwickt" {...register("note")} />}
        </Field>

        <SteppedNumberField
          label="Wdh."
          value={Number(watchedReps) || 0}
          onChange={(v) => setValue("reps", v)}
          step={1}
          min={1}
          inputProps={register("reps")}
        />
        <SteppedNumberField
          label="kg"
          value={Number(watchedWeight) || 0}
          onChange={(v) => setValue("weightKg", v)}
          step={2.5}
          inputProps={register("weightKg")}
        />

        {!editingLog && (
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-text-muted">Superset / Dropset</span>
            <SegmentedControl
              label="Superset / Dropset"
              value={supersetMode}
              onChange={(v) => {
                if (v === "join" && !lastSupersetGroupId) return;
                setSupersetMode(v);
              }}
              options={[
                { value: "none", label: "Einzeln" },
                { value: "new", label: "Neue Gruppe" },
                { value: "join", label: "Zu letzter" },
              ]}
            />
          </div>
        )}

        {Number(watchedWeight) > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowWarmup((v) => !v)}
              className="min-h-11 text-small text-accent-text hover:text-accent-text-hover"
            >
              {showWarmup ? "Aufwärmpyramide ausblenden" : "Aufwärmpyramide anzeigen"}
            </button>
            {showWarmup && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {warmupSteps.map((step) => (
                  <div
                    key={step.percent}
                    className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-center"
                  >
                    <p className="text-xs text-text-faint">{step.percent}%</p>
                    <p className="tabular font-numeric text-small font-medium text-text">{formatKg(step.weightKg)} kg</p>
                    <p className="tabular font-numeric text-xs text-text-faint">×{step.reps}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {savedCount > 0 && (
          <Callout tone="info">
            {savedCount} {savedCount === 1 ? "Satz" : "Sätze"} gespeichert — bereit für den nächsten.
          </Callout>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {savedCount > 0 ? "Fertig" : "Abbrechen"}
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
