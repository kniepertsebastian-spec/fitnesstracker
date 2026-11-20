import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SET_SCHEME_INFO, TECHNIQUES, TECHNIQUE_INFO, type CreatePlanExerciseInput, type ExerciseDto, type PlanExerciseDto, type SetScheme, type Technique, type TrainingPhase } from "@fitnesstracker/shared";
import { TechniqueInfoButton } from "../training/TechniqueInfoButton";
import { useExercises } from "../../hooks/useWorkoutLogs";
import { useCreatePlanExercise, useUpdatePlanExercise } from "../../hooks/usePlanExercises";
import { Button, Dialog, Field, Input, Select } from "../ui";
import { ExerciseAlternatives } from "../training/ExerciseAlternatives";

const formSchema = z.object({
  exerciseId: z.string().uuid("Bitte eine Übung wählen"),
  targetSets: z.coerce.number().int().positive().optional(),
  targetReps: z.coerce.number().int().positive().optional(),
  // Empty = none / straight sets.
  technique: z.string().optional(),
  setScheme: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;
// zod 4 types coerced/preprocessed fields as `unknown` on the input side, which is what the form
// holds before validation; handleSubmit hands the validated output (FormValues) to the callback.
type FormInput = z.input<typeof formSchema>;

interface Props {
  phase: TrainingPhase;
  open: boolean;
  onClose: () => void;
  dayLabel?: string | null;
  replacingEntry?: PlanExerciseDto | null;
  // Exercises already on the day, left out of the alternatives.
  dayExerciseIds?: string[];
}

export function PlanExerciseFormDialog({ phase, open, onClose, dayLabel, replacingEntry, dayExerciseIds }: Props) {
  const { data: exercises } = useExercises();
  const createPlanExercise = useCreatePlanExercise(phase);
  const updatePlanExercise = useUpdatePlanExercise(phase);
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (!open) return;
    reset({
      exerciseId: replacingEntry?.exerciseId,
      targetSets: replacingEntry?.targetSets ?? undefined,
      targetReps: replacingEntry?.targetReps ?? undefined,
      technique: replacingEntry?.technique ?? "",
      setScheme: replacingEntry?.setScheme ?? "",
    });
    setSearch("");
  }, [open, replacingEntry, reset]);

  const selectedId = watch("exerciseId");
  const selectedTechnique = watch("technique");
  const selectedScheme = watch("setScheme");

  const filteredExercises = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    if (!query) return exercises;
    return exercises?.filter((exercise) => exercise.name.toLocaleLowerCase("de").includes(query));
  }, [exercises, search]);

  const onSubmit = async (data: FormValues) => {
    // A group technique (superset, ...) is not edited here: leave it alone instead of clearing it.
    const keepsGroup = !!replacingEntry?.technique && TECHNIQUE_INFO[replacingEntry.technique].kind === "group";
    const technique = keepsGroup ? undefined : ((data.technique || null) as Technique | null);
    const setScheme = (data.setScheme || null) as SetScheme | null;
    if (replacingEntry) {
      await updatePlanExercise.mutateAsync({
        id: replacingEntry.id,
        input: { exerciseId: data.exerciseId, targetSets: data.targetSets, targetReps: data.targetReps, technique, setScheme: setScheme ?? "STRAIGHT" },
      });
    } else {
      const input: CreatePlanExerciseInput = {
        phase,
        exerciseId: data.exerciseId,
        targetSets: data.targetSets,
        targetReps: data.targetReps,
        dayLabel: dayLabel ?? null,
        technique: technique ?? null,
        setScheme,
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
        {replacingEntry && (
          <ExerciseAlternatives
            exerciseId={replacingEntry.exerciseId}
            excludeIds={dayExerciseIds}
            selectedId={selectedId}
            onPick={(o) => {
              // Clear the search so the picked exercise is visible in the select below.
              setSearch("");
              setValue("exerciseId", o.exerciseId, { shouldValidate: true, shouldDirty: true });
            }}
          />
        )}
        <Field label={replacingEntry ? "Oder im ganzen Katalog suchen" : "Übung suchen"}>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Technik (optional)" hint="Gruppen wie Supersatz startest du im Training.">
            {(p) => (
              <div className="flex items-center gap-1">
                <Select {...p} {...register("technique")}>
                  <option value="">Keine</option>
                  {TECHNIQUES.filter((t) => TECHNIQUE_INFO[t].kind !== "group").map((t) => (
                    <option key={t} value={t}>
                      {TECHNIQUE_INFO[t].label}
                    </option>
                  ))}
                </Select>
                {selectedTechnique && <TechniqueInfoButton subject={{ kind: "technique", id: selectedTechnique as Technique }} />}
              </div>
            )}
          </Field>
          <Field label="Satzschema (optional)">
            {(p) => (
              <div className="flex items-center gap-1">
                <Select {...p} {...register("setScheme")}>
                  <option value="">Gleichbleibende Sätze</option>
                  <option value="PYRAMID">{SET_SCHEME_INFO.PYRAMID.label}</option>
                  <option value="TIME_BASED">{SET_SCHEME_INFO.TIME_BASED.label}</option>
                </Select>
                {(selectedScheme === "PYRAMID" || selectedScheme === "TIME_BASED") && (
                  <TechniqueInfoButton subject={{ kind: "scheme", id: selectedScheme }} />
                )}
              </div>
            )}
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
