import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ExerciseCard } from "../components/exerciseLibrary/ExerciseCard";
import { ExerciseFormDialog } from "../components/exerciseLibrary/ExerciseFormDialog";
import { useExerciseFacets, useExerciseLibrary } from "../hooks/useExerciseLibrary";

export function ExerciseLibraryPage() {
  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: facets } = useExerciseFacets();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExerciseLibrary({ search, muscleGroup, equipment, includeInactive });

  const exercises = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Übungen</h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400"
        >
          + Übung
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <input
          type="search"
          placeholder="Übung suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100"
          >
            <option value="">Alle Muskelgruppen</option>
            {facets?.muscleGroups.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-ink-100"
          >
            <option value="">Alle Equipment</option>
            {facets?.equipment.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-400">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          Auch inaktive Übungen anzeigen
        </label>
      </div>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : exercises.length === 0 ? (
        <p className="text-ink-500">Keine Übungen gefunden.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-500">
            {exercises.length} von {total}
          </p>
          <div className="flex flex-col gap-2">
            {exercises.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="mt-4 w-full rounded-lg border border-ink-700 py-2 text-sm text-ink-300 hover:bg-ink-800 disabled:opacity-50"
            >
              {isFetchingNextPage ? "Lädt…" : "Mehr laden"}
            </button>
          )}
        </>
      )}

      <ExerciseFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingExercise={null} />
    </AppShell>
  );
}
