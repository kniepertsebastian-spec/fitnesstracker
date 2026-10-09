import { useEffect, useState } from "react";
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

const formSchema = z.object({
  exerciseId: z.string().uuid({ message: "Bitte eine Übung wählen" }),
  setNumber: z.coerce.number().int().positive(),
  reps: z.coerce.number().int().positive(),
  weightKg: z.coerce.number().nonnegative(),
  rir: z.union([z.coerce.number().int().min(0).max(10), z.literal("")]).optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingLog: LocalWorkoutLog | null;
}

// Remembered for the lifetime of the tab (module-level, not persisted) so "add to last group"
// works across dialog opens within one session without needing a new data model just to track
// "what superset was I just building" — reloading the page starts a fresh session, which is fine.
let lastSupersetGroupId: string | null = null;

type SupersetMode = "none" | "new" | "join";

function isToday(performedAt: string): boolean {
  const d = new Date(performedAt);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

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
            className="h-12 text-center font-mono"
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

export function WorkoutLogFormDialog({ open, onClose, editingLog }: Props) {
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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const watchedWeight = watch("weightKg");
  const watchedReps = watch("reps");
  const watchedExerciseId = watch("exerciseId");

  useEffect(() => {
    if (editingLog) {
      reset({
        exerciseId: editingLog.exerciseId,
        setNumber: editingLog.setNumber,
        reps: editingLog.reps,
        weightKg: editingLog.weightKg,
        rir: editingLog.rir ?? "",
      });
      setSupersetMode(editingLog.supersetGroupId ? "join" : "none");
    } else {
      reset({ exerciseId: undefined, setNumber: 1, reps: 10, weightKg: 0, rir: "" });
      setSupersetMode("none");
    }
    setShowWarmup(false);
    setSavedCount(0);
  }, [editingLog, reset, open]);

  // Prefills reps/weight from the last time this exercise was logged, and sets the set number to
  // "however many sets of this exercise are already logged today, plus one" — the roadmap's
  // "letzte Werte sinnvoll vorausfüllen" ask. Only runs when picking a *new* exercise (not on
  // every keystroke) and never in edit mode, where the existing values are the point.
  useEffect(() => {
    if (editingLog || !watchedExerciseId || !allLogs) return;
    const lastLog = allLogs.find((log) => log.exerciseId === watchedExerciseId);
    const todaysSetCount = allLogs.filter(
      (log) => log.exerciseId === watchedExerciseId && isToday(log.performedAt),
    ).length;
    if (lastLog) {
      setValue("weightKg", lastLog.weightKg);
      setValue("reps", lastLog.reps);
    }
    setValue("setNumber", todaysSetCount + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedExerciseId]);

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
    const supersetGroupId = resolveSupersetGroupId();

    if (editingLog) {
      await updateLog.mutateAsync({
        clientId: editingLog.clientId,
        input: { ...data, rir },
        exerciseName,
      });
      onClose();
      return;
    }

    // Captured before the create call — once it resolves, allLogs (the react-query cache) has
    // already absorbed the new set, which would make it compare against itself.
    const performedAt = new Date().toISOString();
    const prs = detectPRs(allLogs ?? [], data.exerciseId, [
      { reps: data.reps, weightKg: data.weightKg, performedAt },
    ]);

    await createLog.mutateAsync({
      input: { ...data, rir, supersetGroupId, clientId: crypto.randomUUID() },
      exerciseName,
    });
    if (prLabels(prs).length > 0) {
      showPR(exerciseName, prLabels(prs));
    }
    // Only a newly logged set starts the rest timer — editing a past entry (e.g. fixing a
    // typo) isn't "I just finished a set", so it shouldn't interrupt whatever timer is
    // already running (or start one out of nowhere).
    if (autoStartEnabled) {
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
      title={editingLog ? "Satz bearbeiten" : "Satz hinzufügen"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field
          label="Übung"
          error={errors.exerciseId?.message}
          hint={
            lastLogForExercise
              ? `Zuletzt: ${lastLogForExercise.reps} Wdh. × ${lastLogForExercise.weightKg} kg`
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
              className="min-h-9 text-small text-accent hover:text-accent-hover"
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
                    <p className="tabular font-mono text-small font-medium text-text">{step.weightKg} kg</p>
                    <p className="tabular font-mono text-xs text-text-faint">×{step.reps}</p>
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
