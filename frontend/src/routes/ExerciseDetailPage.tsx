import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { useExercise } from "../hooks/useExerciseLibrary";

export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: exercise, isLoading } = useExercise(id);

  return (
    <AppShell>
      <Link to="/exercises" className="mb-4 inline-block text-sm text-slate-400 hover:text-slate-200">
        ← Übungen
      </Link>

      {isLoading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : !exercise ? (
        <p className="text-slate-500">Übung nicht gefunden.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">{exercise.name}</h1>

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
              <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                {exercise.equipment}
              </span>
            )}
            {exercise.category && (
              <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                {exercise.category}
              </span>
            )}
            {exercise.primaryMuscles.map((m) => (
              <span key={m} className="rounded-full bg-sky-950 px-3 py-1 text-sky-300">
                {m}
              </span>
            ))}
            {exercise.secondaryMuscles.map((m) => (
              <span key={m} className="rounded-full bg-slate-800 px-3 py-1 text-slate-400">
                {m}
              </span>
            ))}
          </div>

          {exercise.description && (
            <p className="whitespace-pre-line text-slate-300">{exercise.description}</p>
          )}

          {exercise.videoUrl ? (
            <a
              href={exercise.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-sky-400 hover:text-sky-300"
            >
              Video ansehen ↗
            </a>
          ) : (
            <p className="text-sm text-slate-600">Kein Video verfügbar.</p>
          )}
        </div>
      )}
    </AppShell>
  );
}
