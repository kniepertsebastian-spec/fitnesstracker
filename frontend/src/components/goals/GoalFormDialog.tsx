import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CreateGoalInput, ExerciseDto, GoalDto, UpdateGoalInput } from "@fitnesstracker/shared";
import { goalTypeSchema } from "@fitnesstracker/shared";
import { useExercises } from "../../hooks/useWorkoutLogs";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useCreateGoal, useUpdateGoal } from "../../hooks/useGoals";

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
  editingGoal?: GoalDto | null;
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

// Same form for create and edit — type and exercise are immutable once a goal exists (see
// updateGoalSchema's comment), so in edit mode those two fields render read-only instead of a
// second, near-duplicate dialog just to lock two fields.
export function GoalFormDialog({ open, onClose, editingGoal }: Props) {
  const { data: exercises } = useExercises();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

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

  useEffect(() => {
    if (editingGoal) {
      reset({
        type: editingGoal.type,
        exerciseId: editingGoal.exerciseId ?? undefined,
        targetValue: editingGoal.targetValue,
        targetDate: toDateInputValue(editingGoal.targetDate),
      });
    } else {
      reset({ type: "WEIGHT", targetValue: 0, exerciseId: undefined, targetDate: undefined });
    }
  }, [editingGoal, reset, open]);

  if (!open) return null;

  const onSubmit = async (data: FormValues) => {
    const targetDate = data.targetDate
      ? new Date(`${data.targetDate}T00:00:00.000Z`).toISOString()
      : undefined;

    if (editingGoal) {
      const input: UpdateGoalInput = {
        targetValue: data.targetValue,
        targetDate: targetDate ?? null,
      };
      await updateGoal.mutateAsync({ id: editingGoal.id, input });
    } else {
      const input: CreateGoalInput = {
        type: data.type,
        exerciseId: needsExercise ? data.exerciseId : undefined,
        targetValue: data.targetValue,
        targetDate,
      };
      await createGoal.mutateAsync(input);
    }
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-surface p-4 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">
          {editingGoal ? "Ziel bearbeiten" : "Ziel hinzufügen"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-text-subtle">Art</label>
            {editingGoal ? (
              <p className="rounded-lg border border-border bg-bg px-3 py-2 text-text-subtle">
                {GOAL_TYPE_LABELS[editingGoal.type]}
                {editingGoal.exerciseName && ` · ${editingGoal.exerciseName}`}
              </p>
            ) : (
              <select
                className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
                {...register("type")}
              >
                {goalTypeSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {GOAL_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!editingGoal && needsExercise && (
            <div>
              <label className="mb-1 block text-sm text-text-subtle">Übung</label>
              <select
                className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
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
                <p className="mt-1 text-sm text-danger-text">{errors.exerciseId.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-text-subtle">
              Zielwert {GOAL_TYPE_UNITS[type] && `(${GOAL_TYPE_UNITS[type]})`}
            </label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
              {...register("targetValue")}
            />
            {errors.targetValue && (
              <p className="mt-1 text-sm text-danger-text">{errors.targetValue.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-subtle">Zieldatum (optional)</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
              {...register("targetDate")}
            />
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border-strong py-2 text-text-muted hover:bg-surface-2"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-accent py-2 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
