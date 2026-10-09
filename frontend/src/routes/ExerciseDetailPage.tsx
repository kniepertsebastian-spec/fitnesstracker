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
      <Link to="/exercises" className="mb-4 inline-block text-sm text-text-subtle hover:text-text-2">
        ← Übungen
      </Link>

      {isLoading ? (
        <p className="text-text-faint">Lädt…</p>
      ) : !exercise ? (
        <p className="text-text-faint">Übung nicht gefunden.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              {exercise.name}
              {!exercise.isActive && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-normal text-text-faint">
                  Inaktiv
                </span>
              )}
            </h1>
            <button
              onClick={() => setDialogOpen(true)}
              className="text-sm text-accent hover:underline"
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
              <span className="rounded-full bg-surface-2 px-3 py-1 text-text-muted">
                {exercise.equipment}
              </span>
            )}
            {exercise.category && (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-text-muted">
                {exercise.category}
              </span>
            )}
            {exercise.primaryMuscles.map((m) => (
              <span key={m} className="rounded-full bg-accent-soft px-3 py-1 text-accent-hover">
                {m}
              </span>
            ))}
            {exercise.secondaryMuscles.map((m) => (
              <span key={m} className="rounded-full bg-surface-2 px-3 py-1 text-text-subtle">
                {m}
              </span>
            ))}
          </div>

          {exercise.description && (
            <p className="whitespace-pre-line text-text-muted">{exercise.description}</p>
          )}

          {exercise.videoUrl ? (
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent hover:text-accent-hover"
            >
              Video ansehen ↗
            </a>
          ) : (
            <p className="text-sm text-text-faint">Kein Video verfügbar.</p>
          )}

          <div className="flex gap-4 border-t border-border pt-4 text-sm">
            <button
              onClick={toggleActive}
              disabled={updateExercise.isPending}
              className="text-text-muted hover:underline disabled:opacity-50"
            >
              {exercise.isActive ? "Deaktivieren" : "Aktivieren"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteExercise.isPending}
              className="text-danger-text hover:underline disabled:opacity-50"
            >
              Löschen
            </button>
          </div>
          {deleteError && <p className="text-sm text-danger-text">{deleteError}</p>}
        </div>
      )}

      <ExerciseFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingExercise={exercise ?? null} />
    </AppShell>
  );
}
