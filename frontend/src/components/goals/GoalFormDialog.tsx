import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CreateGoalInput, ExerciseDto } from "@fitnesstracker/shared";
import { goalTypeSchema } from "@fitnesstracker/shared";
import { useExercises } from "../../hooks/useWorkoutLogs";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useCreateGoal } from "../../hooks/useGoals";

const formSchema = z
  .object({
    type: goalTypeSchema,
    exerciseId: z.string().optional(),
    targetValue: z.coerce.number().positive(),
    targetDate: z.string().optional(),
  })
  .refine((data) => (data.type === "WEIGHT" || data.type === "REPS" ? !!data.exerciseId : true), {
    message: "Bitte eine Übung wählen",
    path: ["exerciseId"],
  });
type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GoalFormDialog({ open, onClose }: Props) {
  const { data: exercises } = useExercises();
  const createGoal = useCreateGoal();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "WEIGHT", targetValue: 0 },
  });
  const type = watch("type");
  const needsExercise = type === "WEIGHT" || type === "REPS";

  if (!open) return null;

  const onSubmit = async (data: FormValues) => {
    const input: CreateGoalInput = {
      type: data.type,
      exerciseId: needsExercise ? data.exerciseId : undefined,
      targetValue: data.targetValue,
      targetDate: data.targetDate ? new Date(`${data.targetDate}T00:00:00.000Z`).toISOString() : undefined,
    };
    await createGoal.mutateAsync(input);
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-slate-900 p-4 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">Ziel hinzufügen</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-400">Art</label>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              {...register("type")}
            >
              {goalTypeSchema.options.map((value) => (
                <option key={value} value={value}>
                  {GOAL_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {needsExercise && (
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
          )}

          <div>
            <label className="mb-1 block text-sm text-slate-400">
              Zielwert {GOAL_TYPE_UNITS[type] && `(${GOAL_TYPE_UNITS[type]})`}
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              {...register("targetValue")}
            />
            {errors.targetValue && (
              <p className="mt-1 text-sm text-red-400">{errors.targetValue.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Zieldatum (optional)</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              {...register("targetDate")}
            />
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
              className="flex-1 rounded-lg bg-violet-500 py-2 font-medium text-slate-950 hover:bg-violet-400 disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
