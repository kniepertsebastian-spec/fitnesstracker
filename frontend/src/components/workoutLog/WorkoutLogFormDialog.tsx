import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import type { ExerciseDto } from "@fitnesstracker/shared";
import type { LocalWorkoutLog } from "../../offline/db";
import { useCreateWorkoutLog, useExercises, useUpdateWorkoutLog, useWorkoutLogs } from "../../hooks/useWorkoutLogs";
import { useTimerStore } from "../../stores/timerStore";
import { usePRToastStore } from "../../stores/prToastStore";
import { buildWarmupPyramid } from "../../lib/oneRepMax";
import { detectPRs, prLabels } from "../../lib/prDetection";

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
    <div>
      <label className="mb-1 block text-sm text-ink-400">{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, round((Number(value) || 0) - step)))}
          className="h-10 w-10 shrink-0 rounded-lg border border-ink-700 text-lg text-ink-300 hover:bg-ink-800"
          aria-label={`${label} verringern`}
        >
          −
        </button>
        <input
          type="number"
          // `step="any"` — a native step-mismatch would otherwise silently block submission
          // (no JS handler runs, no console error) whenever the value carries more precision
          // than the browser's default whole-number step, which the +/- buttons intentionally
          // produce for weight (2.5kg increments).
          step="any"
          className="w-full rounded-lg border border-ink-700 bg-ink-950 px-2 py-2 text-center"
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => onChange(round((Number(value) || 0) + step))}
          className="h-10 w-10 shrink-0 rounded-lg border border-ink-700 text-lg text-ink-300 hover:bg-ink-800"
          aria-label={`${label} erhöhen`}
        >
          +
        </button>
      </div>
    </div>
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-ink-900 p-4 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">
          {editingLog ? "Satz bearbeiten" : "Satz hinzufügen"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-ink-400">Übung</label>
            <select
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
              {...register("exerciseId")}
              defaultValue=""
            >
              <option value="" disabled>
                Übung wählen…
              </option>
              {exercises?.map((exercise: ExerciseDto) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
            {errors.exerciseId && (
              <p className="mt-1 text-sm text-red-400">{errors.exerciseId.message}</p>
            )}
            {lastLogForExercise && (
              <p className="mt-1 text-xs text-ink-500">
                Zuletzt: {lastLogForExercise.reps} Wdh. × {lastLogForExercise.weightKg}kg
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm text-ink-400">Satz</label>
              <input
                type="number"
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                {...register("setNumber")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-400" title="Reps in Reserve">
                RIR
              </label>
              <input
                type="number"
                min={0}
                max={10}
                placeholder="–"
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                {...register("rir")}
              />
            </div>
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
          {errors.rir && <p className="text-sm text-red-400">{errors.rir.message}</p>}

          {!editingLog && (
            <div>
              <label className="mb-1 block text-sm text-ink-400">Superset / Dropset</label>
              <div className="flex gap-1 rounded-lg border border-ink-800 bg-ink-950 p-1">
                <button
                  type="button"
                  onClick={() => setSupersetMode("none")}
                  className={`flex-1 rounded-md py-1 text-xs font-medium ${
                    supersetMode === "none" ? "bg-violet-500 text-ink-950" : "text-ink-400"
                  }`}
                >
                  Einzeln
                </button>
                <button
                  type="button"
                  onClick={() => setSupersetMode("new")}
                  className={`flex-1 rounded-md py-1 text-xs font-medium ${
                    supersetMode === "new" ? "bg-violet-500 text-ink-950" : "text-ink-400"
                  }`}
                >
                  Neue Gruppe
                </button>
                <button
                  type="button"
                  disabled={!lastSupersetGroupId}
                  onClick={() => setSupersetMode("join")}
                  className={`flex-1 rounded-md py-1 text-xs font-medium disabled:opacity-30 ${
                    supersetMode === "join" ? "bg-violet-500 text-ink-950" : "text-ink-400"
                  }`}
                >
                  Zu letzter
                </button>
              </div>
            </div>
          )}

          {Number(watchedWeight) > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowWarmup((v) => !v)}
                className="text-xs text-violet-400 hover:underline"
              >
                {showWarmup ? "Aufwärmpyramide ausblenden" : "Aufwärmpyramide anzeigen"}
              </button>
              {showWarmup && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {warmupSteps.map((step) => (
                    <div
                      key={step.percent}
                      className="rounded-lg border border-ink-800 bg-ink-950 px-2 py-1.5 text-center"
                    >
                      <p className="text-xs text-ink-500">{step.percent}%</p>
                      <p className="text-sm font-medium text-ink-100">{step.weightKg}kg</p>
                      <p className="text-xs text-ink-500">×{step.reps}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {savedCount > 0 && (
            <p className="text-xs text-emerald-400">
              ✓ {savedCount} {savedCount === 1 ? "Satz" : "Sätze"} gespeichert — bereit für den
              nächsten
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-ink-700 py-2 text-ink-300 hover:bg-ink-800"
            >
              {savedCount > 0 ? "Fertig" : "Abbrechen"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-violet-500 py-2 font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
