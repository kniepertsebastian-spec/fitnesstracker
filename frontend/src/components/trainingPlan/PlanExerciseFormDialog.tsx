import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CreatePlanExerciseInput, ExerciseDto, TrainingPhase } from "@fitnesstracker/shared";
import { useExercises } from "../../hooks/useWorkoutLogs";
import { useCreatePlanExercise } from "../../hooks/usePlanExercises";

const formSchema = z.object({
  exerciseId: z.string().uuid("Bitte eine Übung wählen"),
  targetSets: z.coerce.number().int().positive().optional(),
  targetReps: z.coerce.number().int().positive().optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface Props {
  phase: TrainingPhase;
  open: boolean;
  onClose: () => void;
}

export function PlanExerciseFormDialog({ phase, open, onClose }: Props) {
  const { data: exercises } = useExercises();
  const createPlanExercise = useCreatePlanExercise(phase);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  if (!open) return null;

  const onSubmit = async (data: FormValues) => {
    const input: CreatePlanExerciseInput = {
      phase,
      exerciseId: data.exerciseId,
      targetSets: data.targetSets,
      targetReps: data.targetReps,
    };
    await createPlanExercise.mutateAsync(input);
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-ink-900 p-4 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">Übung zur Phase hinzufügen</h2>
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
            {errors.exerciseId && <p className="mt-1 text-sm text-red-400">{errors.exerciseId.message}</p>}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-ink-400">Sätze (optional)</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                {...register("targetSets")}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-ink-400">Wdh. (optional)</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
                {...register("targetReps")}
              />
            </div>
          </div>

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
