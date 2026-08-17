import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { ExerciseDto, WorkoutLogDto } from "@fitnesstracker/shared";
import { useCreateWorkoutLog, useExercises, useUpdateWorkoutLog } from "../../hooks/useWorkoutLogs";

const formSchema = z.object({
  exerciseId: z.string().uuid({ message: "Bitte eine Übung wählen" }),
  setNumber: z.coerce.number().int().positive(),
  reps: z.coerce.number().int().positive(),
  weightKg: z.coerce.number().nonnegative(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editingLog: WorkoutLogDto | null;
}

export function WorkoutLogFormDialog({ open, onClose, editingLog }: Props) {
  const { data: exercises } = useExercises();
  const createLog = useCreateWorkoutLog();
  const updateLog = useUpdateWorkoutLog();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (editingLog) {
      reset({
        exerciseId: editingLog.exerciseId,
        setNumber: editingLog.setNumber,
        reps: editingLog.reps,
        weightKg: editingLog.weightKg,
      });
    } else {
      reset({ exerciseId: undefined, setNumber: 1, reps: 10, weightKg: 0 });
    }
  }, [editingLog, reset, open]);

  if (!open) return null;

  const onSubmit = async (data: FormValues) => {
    if (editingLog) {
      await updateLog.mutateAsync({ id: editingLog.id, input: data });
    } else {
      await createLog.mutateAsync({ ...data, clientId: crypto.randomUUID() });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-slate-900 p-4 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">
          {editingLog ? "Satz bearbeiten" : "Satz hinzufügen"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Übung</label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Satz</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                {...register("setNumber")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Wdh.</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                {...register("reps")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">kg</label>
              <input
                type="number"
                step="0.5"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                {...register("weightKg")}
              />
            </div>
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 py-2 text-slate-300 hover:bg-slate-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-sky-500 py-2 font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
