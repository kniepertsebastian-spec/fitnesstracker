import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { ExerciseCard } from "../components/exerciseLibrary/ExerciseCard";
import { ExerciseFormDialog } from "../components/exerciseLibrary/ExerciseFormDialog";
import { Button, Card, EmptyState, FilterPills, Input, Skeleton, Toggle } from "../components/ui";
import { useExerciseFacets, useExerciseLibrary } from "../hooks/useExerciseLibrary";

export function ExerciseLibraryPage() {
  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: facets } = useExerciseFacets();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useExerciseLibrary({
    search,
    muscleGroup,
    equipment,
    includeInactive,
  });

  const exercises = data?.pages.flatMap((page) => page.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-h1 text-text lg:text-h1-lg">Übungen</h1>
        <Button variant="primary" iconLeft={<Plus size={18} aria-hidden />} onClick={() => setDialogOpen(true)}>
          Übung
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <Input
          type="search"
          aria-label="Übung suchen"
          placeholder="Übung suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterPills label="Muskelgruppe" options={facets?.muscleGroups ?? []} value={muscleGroup} onChange={setMuscleGroup} allLabel="Alle Muskeln" />
        <FilterPills label="Equipment" options={facets?.equipment ?? []} value={equipment} onChange={setEquipment} allLabel="Alle Geräte" />
        <Toggle label="Auch inaktive Übungen anzeigen" checked={includeInactive} onChange={setIncludeInactive} />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : exercises.length === 0 ? (
        <Card>
          <EmptyState icon={<Search size={18} aria-hidden />} text="Keine Übungen gefunden." />
        </Card>
      ) : (
        <>
          <p className="tabular mb-2 text-small text-text-faint">
            {exercises.length} von {total}
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {exercises.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
          {hasNextPage && (
            <Button variant="ghost" fullWidth className="mt-4" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? "Lädt…" : "Mehr laden"}
            </Button>
          )}
        </>
      )}

      <ExerciseFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} editingExercise={null} />
    </AppShell>
  );
}
