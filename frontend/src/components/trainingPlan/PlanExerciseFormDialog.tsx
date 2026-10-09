import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CreatePlanExerciseInput, ExerciseDto, PlanExerciseDto, TrainingPhase } from "@fitnesstracker/shared";
import { useExercises } from "../../hooks/useWorkoutLogs";
import { useCreatePlanExercise, useUpdatePlanExercise } from "../../hooks/usePlanExercises";
import { Button, Dialog, Field, Input, Select } from "../ui";

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
  dayLabel?: string | null;
  replacingEntry?: PlanExerciseDto | null;
}

export function PlanExerciseFormDialog({ phase, open, onClose, dayLabel, replacingEntry }: Props) {
  const { data: exercises } = useExercises();
  const createPlanExercise = useCreatePlanExercise(phase);
  const updatePlanExercise = useUpdatePlanExercise(phase);
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (!open) return;
    reset({
      exerciseId: replacingEntry?.exerciseId,
      targetSets: replacingEntry?.targetSets ?? undefined,
      targetReps: replacingEntry?.targetReps ?? undefined,
    });
    setSearch("");
  }, [open, replacingEntry, reset]);

  const filteredExercises = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    if (!query) return exercises;
    return exercises?.filter((exercise) => exercise.name.toLocaleLowerCase("de").includes(query));
  }, [exercises, search]);

  const onSubmit = async (data: FormValues) => {
    if (replacingEntry) {
      await updatePlanExercise.mutateAsync({
        id: replacingEntry.id,
        input: { exerciseId: data.exerciseId, targetSets: data.targetSets, targetReps: data.targetReps },
      });
    } else {
      const input: CreatePlanExerciseInput = {
        phase,
        exerciseId: data.exerciseId,
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        dayLabel: dayLabel ?? null,
      };
      await createPlanExercise.mutateAsync(input);
    }
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={replacingEntry ? "Übung ersetzen" : "Übung hinzufügen"}
      description={dayLabel ? `Trainingstag: ${dayLabel}` : undefined}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Übung suchen">
          {(p) => (
            <Input
              {...p}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Übung suchen…"
            />
          )}
        </Field>
        <Field label="Übung" error={errors.exerciseId?.message}>
          {(p) => (
            <Select {...p} {...register("exerciseId")} defaultValue="">
              <option value="" disabled>
                Übung wählen…
              </option>
              {filteredExercises?.map((exercise: ExerciseDto) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sätze (optional)">
            {(p) => <Input {...p} type="number" min={1} inputMode="numeric" {...register("targetSets")} />}
          </Field>
          <Field label="Wdh. (optional)">
            {(p) => <Input {...p} type="number" min={1} inputMode="numeric" {...register("targetReps")} />}
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {replacingEntry ? "Ersetzen" : "Hinzufügen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
