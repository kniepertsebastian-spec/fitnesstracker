import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CreateGoalInput, ExerciseDto, GoalDto, UpdateGoalInput } from "@fitnesstracker/shared";
import { goalTypeSchema } from "@fitnesstracker/shared";
import { useExercises } from "../../hooks/useWorkoutLogs";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useCreateGoal, useUpdateGoal } from "../../hooks/useGoals";
import { Button, Dialog, Field, Input, Select } from "../ui";

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
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editingGoal ? "Ziel bearbeiten" : "Ziel hinzufügen"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {editingGoal ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-text-muted">Art</span>
            <p className="rounded-md border border-border bg-surface-inset px-3 py-2.5 text-body text-text-subtle">
              {GOAL_TYPE_LABELS[editingGoal.type]}
              {editingGoal.exerciseName && ` · ${editingGoal.exerciseName}`}
            </p>
          </div>
        ) : (
          <Field label="Art">
            {(p) => (
              <Select {...p} {...register("type")}>
                {goalTypeSchema.options.map((value) => (
                  <option key={value} value={value}>
                    {GOAL_TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {!editingGoal && needsExercise && (
          <Field label="Übung" error={errors.exerciseId?.message}>
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
        )}

        <Field
          label={`Zielwert${GOAL_TYPE_UNITS[type] ? ` (${GOAL_TYPE_UNITS[type]})` : ""}`}
          error={errors.targetValue?.message}
        >
          {(p) => <Input {...p} type="number" step="0.1" inputMode="decimal" {...register("targetValue")} />}
        </Field>

        <Field label="Zieldatum (optional)">{(p) => <Input {...p} type="date" {...register("targetDate")} />}</Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
