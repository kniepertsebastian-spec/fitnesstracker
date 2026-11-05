import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { useExercise } from "../../hooks/useExerciseLibrary";
import { Badge, ButtonLink, IconButton, Sheet, SheetClose, Skeleton } from "../ui";

// Exercise detail (images, description, muscles) in a right-hand sheet, so checking the technique
// never leaves the focus mode.
export function TechniqueSheet({
  exerciseId,
  open,
  onOpenChange,
}: {
  exerciseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: exercise, isLoading } = useExercise(exerciseId ?? undefined);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Technik" className="gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-text">{exercise?.name ?? "Technik"}</h2>
        <SheetClose asChild>
          <IconButton aria-label="Schließen">
            <X size={20} aria-hidden />
          </IconButton>
        </SheetClose>
      </div>
      {isLoading && <Skeleton className="h-40 w-full" />}
      {exercise && (
        <>
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
          <div className="flex flex-wrap gap-2">
            {exercise.primaryMuscles.map((m) => (
              <Badge key={m} tone="info">
                {m}
              </Badge>
            ))}
            {exercise.equipment && <Badge>{exercise.equipment}</Badge>}
          </div>
          {exercise.description ? (
            <p className="whitespace-pre-line text-body text-text-2">{exercise.description}</p>
          ) : (
            <p className="text-small text-text-subtle">Keine Beschreibung vorhanden.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {exercise.videoUrl && (
              <a
                href={exercise.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center rounded-md border border-border-strong px-4 text-body text-text-muted hover:bg-surface-2"
              >
                Video ansehen
              </a>
            )}
            <ButtonLink to={`/exercises/${exercise.id}`} variant="ghost">
              Zur Übung
            </ButtonLink>
          </div>
          <p className="text-xs text-text-faint">
            Formanalyse per Video findest du im{" "}
            <Link to="/plan" className="text-accent hover:text-accent-hover">
              Plan
            </Link>
            .
          </p>
        </>
      )}
    </Sheet>
  );
}
