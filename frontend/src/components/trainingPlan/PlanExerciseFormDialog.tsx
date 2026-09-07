import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CreatePlanExerciseInput, ExerciseDto, PlanExerciseDto, TrainingPhase } from "@fitnesstracker/shared";
import { useExercises } from "../../hooks/useWorkoutLogs";
import { useCreatePlanExercise, useUpdatePlanExercise } from "../../hooks/usePlanExercises";
import { useLanguage } from "../../i18n";
import { localizedExerciseName } from "../../lib/localizedExercise";

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
  const { language } = useLanguage();

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
    const query = search.trim().toLocaleLowerCase(language);
    if (!query) return exercises;
    return exercises?.filter((exercise) =>
      [exercise.nameEn, exercise.nameDe].some((name) =>
        name?.toLocaleLowerCase(language).includes(query),
      ),
    );
  }, [exercises, language, search]);

  if (!open) return null;

  const onSubmit = async (data: FormValues) => {
    if (replacingEntry) {
      await updatePlanExercise.mutateAsync({
        id: replacingEntry.id,
        input: {
          exerciseId: data.exerciseId,
          targetSets: data.targetSets,
          targetReps: data.targetReps,
        },
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
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-ink-900 p-4 sm:rounded-2xl">
        <h2 className="mb-1 text-lg font-semibold">
          {replacingEntry ? "Übung ersetzen" : "Übung hinzufügen"}
        </h2>
        {dayLabel && <p className="mb-4 text-sm text-ink-400">Trainingstag: {dayLabel}</p>}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-ink-400">Übung</label>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Übung suchen…"
              aria-label="Übung suchen"
              className="mb-2 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
            />
            <select
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
              {...register("exerciseId")}
              defaultValue=""
            >
              <option value="" disabled>
                Übung wählen…
              </option>
              {filteredExercises?.map((exercise: ExerciseDto) => (
                <option key={exercise.id} value={exercise.id}>
                  {localizedExerciseName(exercise, language)}
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
              {replacingEntry ? "Ersetzen" : "Hinzufügen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
