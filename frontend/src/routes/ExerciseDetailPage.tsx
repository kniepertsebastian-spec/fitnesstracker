import { useState } from "react";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { AppShell } from "../components/layout/AppShell";
import { ExerciseFormDialog } from "../components/exerciseLibrary/ExerciseFormDialog";
import { Badge, Button, Callout, Card, Dialog, Skeleton } from "../components/ui";
import { Sparkline } from "../components/progress/Sparkline";
import { useDeleteExercise, useExercise, useUpdateExercise } from "../hooks/useExerciseLibrary";
import { useWorkoutLogs } from "../hooks/useWorkoutLogs";
import { estimateOneRepMax } from "../lib/oneRepMax";

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: exercise, isLoading } = useExercise(id);
  const { data: logs } = useWorkoutLogs();
  const updateExercise = useUpdateExercise();
  const deleteExercise = useDeleteExercise();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      setConfirmDelete(false);
      setDeleteError(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen");
    }
  };

  // The exercise's own progress: best estimated 1RM per training day, from the cached log.
  const series = (() => {
    if (!exercise) return [];
    const byDay = new Map<string, number>();
    for (const log of logs ?? []) {
      if (log.exerciseId !== exercise.id) continue;
      const rm = estimateOneRepMax(log.weightKg, log.reps);
      if (rm === null) continue;
      const day = log.performedAt.slice(0, 10);
      byDay.set(day, Math.max(byDay.get(day) ?? 0, rm));
    }
    return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
  })();

  return (
    <AppShell>
      <Link to="/exercises" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-small text-text-subtle hover:text-text">
        <ArrowLeft size={16} aria-hidden /> Übungen
      </Link>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !exercise ? (
        <p className="text-text-subtle">Übung nicht gefunden.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="flex flex-wrap items-center gap-2 text-h1 text-text lg:text-h1-lg">
              {exercise.name}
              {!exercise.isActive && <Badge>Inaktiv</Badge>}
            </h1>
            <Button variant="secondary" iconLeft={<Pencil size={16} aria-hidden />} onClick={() => setDialogOpen(true)}>
              Bearbeiten
            </Button>
          </div>

          {exercise.imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:max-w-2xl">
              {exercise.imageUrls.slice(0, 2).map((url) => (
                <img key={url} src={url} alt={exercise.name} className="aspect-[4/3] w-full rounded-xl bg-track object-contain" />
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {exercise.equipment && <Badge>{exercise.equipment}</Badge>}
            {exercise.category && <Badge>{exercise.category}</Badge>}
            {exercise.primaryMuscles.map((m) => (
              <Badge key={m} tone="info">
                {m}
              </Badge>
            ))}
            {exercise.secondaryMuscles.map((m) => (
              <Badge key={m}>{m}</Badge>
            ))}
          </div>

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
            <Card title="Beschreibung">
              {exercise.description ? (
                <p className="whitespace-pre-line text-body text-text-2">{exercise.description}</p>
              ) : (
                <p className="text-small text-text-faint">Keine Beschreibung vorhanden.</p>
              )}
              {exercise.videoUrl ? (
                <a
                  href={exercise.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-body text-accent hover:text-accent-hover"
                >
                  Video ansehen <ExternalLink size={14} aria-hidden />
                </a>
              ) : (
                <p className="mt-3 text-small text-text-faint">Kein Video verfügbar.</p>
              )}
            </Card>

            <Card title="Mein Verlauf">
              {series.length >= 2 ? (
                <>
                  <Sparkline
                    values={series}
                    label={`${exercise.name}: geschätztes 1RM von ${Math.round(series[0])} auf ${Math.round(series.at(-1)!)} kg`}
                  />
                  <p className="mt-1 text-xs text-text-faint">
                    Geschätztes 1RM je Trainingstag, {series.length} Einheiten. Bestwert {Math.round(Math.max(...series))} kg.
                  </p>
                </>
              ) : (
                <p className="text-small text-text-faint">Noch zu wenige Trainingstage für einen Verlauf.</p>
              )}
            </Card>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <Button variant="ghost" disabled={updateExercise.isPending} onClick={toggleActive}>
              {exercise.isActive ? "Deaktivieren" : "Aktivieren"}
            </Button>
            <Button variant="danger" disabled={deleteExercise.isPending} onClick={() => setConfirmDelete(true)}>
              Löschen
            </Button>
          </div>
          {deleteError && <Callout tone="danger">{deleteError}</Callout>}

          <Dialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            title="Übung löschen?"
            description={`${exercise.name} wird dauerhaft entfernt.`}
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
                <Button variant="danger" disabled={deleteExercise.isPending} onClick={handleDelete}>
                  Löschen
                </Button>
              </>
            }
          >
            <p className="text-small text-text-subtle">Das lässt sich nicht rückgängig machen.</p>
          </Dialog>
        </div>
      )}

      <ExerciseFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingExercise={exercise ?? null} />
    </AppShell>
  );
}
