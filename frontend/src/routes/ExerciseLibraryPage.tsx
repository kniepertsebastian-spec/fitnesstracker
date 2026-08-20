import { useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ExerciseCard } from "../components/exerciseLibrary/ExerciseCard";
import { useExerciseFacets, useExerciseLibrary } from "../hooks/useExerciseLibrary";

export function ExerciseLibraryPage() {
  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");

  const { data: facets } = useExerciseFacets();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExerciseLibrary({ search, muscleGroup, equipment });

  const exercises = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Übungen</h1>

      <div className="mb-4 flex flex-col gap-2">
        <input
          type="search"
          placeholder="Übung suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
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
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            <option value="">Alle Equipment</option>
            {facets?.equipment.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : exercises.length === 0 ? (
        <p className="text-slate-500">Keine Übungen gefunden.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500">
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
              className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {isFetchingNextPage ? "Lädt…" : "Mehr laden"}
            </button>
          )}
        </>
      )}
    </AppShell>
  );
}
