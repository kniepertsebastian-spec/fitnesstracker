import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { AppShell } from "../components/layout/AppShell";
import { ExerciseFormDialog } from "../components/exerciseLibrary/ExerciseFormDialog";
import { useDeleteExercise, useExercise, useUpdateExercise } from "../hooks/useExerciseLibrary";

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: exercise, isLoading } = useExercise(id);
  const updateExercise = useUpdateExercise();
  const deleteExercise = useDeleteExercise();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const toggleActive = () => {
    if (!exercise) return;
    updateExercise.mutate({ id: exercise.id, input: { isActive: !exercise.isActive } });
  };

  const handleDelete = async () => {
    if (!exercise) return;
    setDeleteError(null);
    try {
      await deleteExercise.mutateAsync(exercise.id);
      navigate("/exercises");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen");
    }
  };

  return (
    <AppShell>
      <Link to="/exercises" className="mb-4 inline-block text-sm text-ink-400 hover:text-ink-200">
        ← Übungen
      </Link>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : !exercise ? (
        <p className="text-ink-500">Übung nicht gefunden.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              {exercise.name}
              {!exercise.isActive && (
                <span className="ml-2 rounded-full bg-ink-800 px-2 py-0.5 text-xs font-normal text-ink-500">
                  Inaktiv
                </span>
              )}
            </h1>
            <button
              onClick={() => setDialogOpen(true)}
              className="text-sm text-violet-400 hover:underline"
            >
              Bearbeiten
            </button>
          </div>

          {exercise.imageUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {exercise.imageUrls.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt={exercise.name}
                  className="h-40 w-40 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-sm">
            {exercise.equipment && (
              <span className="rounded-full bg-ink-800 px-3 py-1 text-ink-300">
                {exercise.equipment}
              </span>
            )}
            {exercise.category && (
              <span className="rounded-full bg-ink-800 px-3 py-1 text-ink-300">
                {exercise.category}
              </span>
            )}
            {exercise.primaryMuscles.map((m) => (
              <span key={m} className="rounded-full bg-violet-950 px-3 py-1 text-violet-300">
                {m}
              </span>
            ))}
            {exercise.secondaryMuscles.map((m) => (
              <span key={m} className="rounded-full bg-ink-800 px-3 py-1 text-ink-400">
                {m}
              </span>
            ))}
          </div>

          {exercise.description && (
            <p className="whitespace-pre-line text-ink-300">{exercise.description}</p>
          )}

          {exercise.videoUrl ? (
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-violet-400 hover:text-violet-300"
            >
              Video ansehen ↗
            </a>
          ) : (
            <p className="text-sm text-ink-600">Kein Video verfügbar.</p>
          )}

          <div className="flex gap-4 border-t border-ink-800 pt-4 text-sm">
            <button
              onClick={toggleActive}
              disabled={updateExercise.isPending}
              className="text-ink-300 hover:underline disabled:opacity-50"
            >
              {exercise.isActive ? "Deaktivieren" : "Aktivieren"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteExercise.isPending}
              className="text-red-400 hover:underline disabled:opacity-50"
            >
              Löschen
            </button>
          </div>
          {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
        </div>
      )}

      <ExerciseFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingExercise={exercise ?? null} />
    </AppShell>
  );
}
