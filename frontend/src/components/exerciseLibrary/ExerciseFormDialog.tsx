import { useEffect, useState, type FormEvent } from "react";
import type { ExerciseDto } from "@fitnesstracker/shared";
import { useCreateExercise, useUpdateExercise } from "../../hooks/useExerciseLibrary";
import { Button, Callout, Dialog, Field, Input, Textarea } from "../ui";

interface Props {
  open: boolean;
  onClose: () => void;
  editingExercise: ExerciseDto | null;
}

// Muscle lists are free-text arrays server-side — a comma-separated text input is the simplest
// editing UI for them without inventing a tag-picker just for this one dialog.
function parseMuscleList(value: string): string[] {
  return value
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

// Shared create/edit dialog for the exercise catalog.
export function ExerciseFormDialog({ open, onClose, editingExercise }: Props) {
  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");
  const [primaryMuscles, setPrimaryMuscles] = useState("");
  const [secondaryMuscles, setSecondaryMuscles] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(editingExercise?.name ?? "");
    setDescription(editingExercise?.description ?? "");
    setVideoUrl(editingExercise?.videoUrl ?? "");
    setEquipment(editingExercise?.equipment ?? "");
    setCategory(editingExercise?.category ?? "");
    setPrimaryMuscles(editingExercise?.primaryMuscles.join(", ") ?? "");
    setSecondaryMuscles(editingExercise?.secondaryMuscles.join(", ") ?? "");
    setError(null);
  }, [editingExercise, open]);

  const isPending = createExercise.isPending || updateExercise.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name erforderlich");
      return;
    }
    setError(null);
    const input = {
      name: name.trim(),
      description: description.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      equipment: equipment.trim() || undefined,
      category: category.trim() || undefined,
      primaryMuscles: parseMuscleList(primaryMuscles),
      secondaryMuscles: parseMuscleList(secondaryMuscles),
    };
    try {
      if (editingExercise) {
        await updateExercise.mutateAsync({ id: editingExercise.id, input });
      } else {
        await createExercise.mutateAsync(input);
      }
      onClose();
    } catch {
      setError("Speichern fehlgeschlagen — bitte Eingaben prüfen");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editingExercise ? "Übung bearbeiten" : "Übung anlegen"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Equipment">{(p) => <Input {...p} value={equipment} onChange={(e) => setEquipment(e.target.value)} />}</Field>
          <Field label="Kategorie">{(p) => <Input {...p} value={category} onChange={(e) => setCategory(e.target.value)} />}</Field>
        </div>
        <Field label="Primäre Muskeln" hint="Komma-getrennt">
          {(p) => <Input {...p} value={primaryMuscles} onChange={(e) => setPrimaryMuscles(e.target.value)} />}
        </Field>
        <Field label="Sekundäre Muskeln" hint="Komma-getrennt">
          {(p) => <Input {...p} value={secondaryMuscles} onChange={(e) => setSecondaryMuscles(e.target.value)} />}
        </Field>
        <Field label="Video-URL">{(p) => <Input {...p} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />}</Field>
        <Field label="Beschreibung">
          {(p) => <Textarea {...p} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>

        {error && <Callout tone="danger">{error}</Callout>}

        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
