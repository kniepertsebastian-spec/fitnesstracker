import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ExerciseDto } from "@fitnesstracker/shared";
import type { LocalWorkoutLog } from "../../offline/db";
import { useCreateWorkoutLog, useExercises, useUpdateWorkoutLog } from "../../hooks/useWorkoutLogs";
import { useTimerStore } from "../../stores/timerStore";
import { buildWarmupPyramid } from "../../lib/oneRepMax";

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

export function WorkoutLogFormDialog({ open, onClose, editingLog }: Props) {
  const { data: exercises } = useExercises();
  const createLog = useCreateWorkoutLog();
  const updateLog = useUpdateWorkoutLog();
  const { autoStartEnabled, autoStartSeconds, start: startRestTimer } = useTimerStore();
  const [supersetMode, setSupersetMode] = useState<SupersetMode>("none");
  const [showWarmup, setShowWarmup] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const watchedWeight = watch("weightKg");

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
  }, [editingLog, reset, open]);

  if (!open) return null;

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
    } else {
      await createLog.mutateAsync({
        input: { ...data, rir, supersetGroupId, clientId: crypto.randomUUID() },
        exerciseName,
      });
      // Only a newly logged set starts the rest timer — editing a past entry (e.g. fixing a
      // typo) isn't "I just finished a set", so it shouldn't interrupt whatever timer is
      // already running (or start one out of nowhere).
      if (autoStartEnabled) {
        startRestTimer(autoStartSeconds);
      }
    }
    onClose();
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
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="mb-1 block text-sm text-ink-400">Satz</label>
              <input
                type="number"
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                {...register("setNumber")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-400">Wdh.</label>
              <input
                type="number"
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                {...register("reps")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-400">kg</label>
              <input
                type="number"
                step="0.5"
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                {...register("weightKg")}
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

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-ink-700 py-2 text-ink-300 hover:bg-ink-800"
            >
              Abbrechen
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
