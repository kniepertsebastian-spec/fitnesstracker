import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateExerciseInput, ExerciseDto, UpdateExerciseInput } from "@fitnesstracker/shared";
import { createExerciseRequest, deleteExerciseRequest, getExerciseByIdRequest, updateExerciseRequest } from "../api/exercise.api";
import { loadExerciseCatalog, syncExerciseCatalog } from "../offline/exerciseCatalog";
import { catalogFacets, filterCatalog, type CatalogFilters } from "../lib/exerciseSearch";

export const EXERCISE_CATALOG_KEY = ["exercise-catalog"];

// The whole catalog, from the copy on the device (kept current in the background, see
// offline/exerciseCatalog.ts). Everything that lists, searches or looks up exercises reads this, so it
// works without a connection and without a request per keystroke.
export function useExerciseCatalog() {
  return useQuery({
    queryKey: EXERCISE_CATALOG_KEY,
    queryFn: () => loadExerciseCatalog(),
    // The queryFn reads the local database itself, so it must run offline too.
    networkMode: "always",
    staleTime: 60_000,
  });
}

export interface ExerciseLibraryFilters {
  search: string;
  muscleGroup: string;
  equipment: string;
  includeInactive?: boolean;
}

export function useExerciseLibrary(filters: ExerciseLibraryFilters) {
  const { data, isLoading } = useExerciseCatalog();
  const { search, muscleGroup, equipment, includeInactive } = filters;
  const items = useMemo(
    () => filterCatalog(data ?? [], { search, muscleGroup, equipment, includeInactive } satisfies CatalogFilters),
    [data, search, muscleGroup, equipment, includeInactive],
  );
  return { items, total: items.length, isLoading };
}

export function useExerciseFacets() {
  const { data } = useExerciseCatalog();
  return useMemo(() => (data ? catalogFacets(data) : undefined), [data]);
}

// One exercise: from the local catalog if it is there, from the server otherwise (e.g. an exercise created
// on another device a moment ago).
export function useExercise(id: string | undefined) {
  const { data: catalog } = useExerciseCatalog();
  const local = useMemo(() => (id && catalog ? catalog.find((e) => e.id === id) : undefined), [id, catalog]);
  const remote = useQuery({
    queryKey: ["exercise", id],
    queryFn: () => getExerciseByIdRequest(id as string),
    enabled: !!id && catalog !== undefined && !local,
  });
  const data: ExerciseDto | undefined = local ?? remote.data;
  return {
    data,
    isLoading: !!id && !data && (catalog === undefined || remote.isLoading),
    isError: !data && remote.isError,
  };
}

// Shared by all three mutations: a create/update/deactivate/delete changes the catalog, so the local copy
// is refreshed from the server first and everything that reads it follows.
function useInvalidateExerciseQueries() {
  const queryClient = useQueryClient();
  return () => {
    void syncExerciseCatalog(true).finally(() => {
      void queryClient.invalidateQueries({ queryKey: EXERCISE_CATALOG_KEY });
      void queryClient.invalidateQueries({ queryKey: ["exercise"] });
    });
  };
}

export function useCreateExercise() {
  const invalidate = useInvalidateExerciseQueries();
  return useMutation({
    mutationFn: (input: CreateExerciseInput) => createExerciseRequest(input),
    onSuccess: invalidate,
  });
}

export function useUpdateExercise() {
  const invalidate = useInvalidateExerciseQueries();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExerciseInput }) => updateExerciseRequest(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteExercise() {
  const invalidate = useInvalidateExerciseQueries();
  return useMutation({
    mutationFn: (id: string) => deleteExerciseRequest(id),
    onSuccess: invalidate,
  });
}
