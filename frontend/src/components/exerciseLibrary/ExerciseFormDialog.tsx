import { useEffect, useState, type FormEvent } from "react";
import type { ExerciseDto } from "@fitnesstracker/shared";
import { useCreateExercise, useUpdateExercise } from "../../hooks/useExerciseLibrary";

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

// Shared create/edit dialog for the exercise catalog — mirrors WorkoutLogFormDialog's layout
// (bottom sheet on mobile, centered on larger screens) for visual consistency across the app.
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
    if (editingExercise) {
      setName(editingExercise.name);
      setDescription(editingExercise.description ?? "");
      setVideoUrl(editingExercise.videoUrl ?? "");
      setEquipment(editingExercise.equipment ?? "");
      setCategory(editingExercise.category ?? "");
      setPrimaryMuscles(editingExercise.primaryMuscles.join(", "));
      setSecondaryMuscles(editingExercise.secondaryMuscles.join(", "));
    } else {
      setName("");
      setDescription("");
      setVideoUrl("");
      setEquipment("");
      setCategory("");
      setPrimaryMuscles("");
      setSecondaryMuscles("");
    }
    setError(null);
  }, [editingExercise, open]);

  if (!open) return null;

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
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-ink-900 p-4 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">
          {editingExercise ? "Übung bearbeiten" : "Übung anlegen"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm text-ink-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm text-ink-400">Equipment</label>
              <input
                type="text"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-ink-400">Kategorie</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-400">Primäre Muskeln (Komma-getrennt)</label>
            <input
              type="text"
              value={primaryMuscles}
              onChange={(e) => setPrimaryMuscles(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-400">Sekundäre Muskeln (Komma-getrennt)</label>
            <input
              type="text"
              value={secondaryMuscles}
              onChange={(e) => setSecondaryMuscles(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-400">Video-URL</label>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-ink-400">Beschreibung</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

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
              disabled={isPending}
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
