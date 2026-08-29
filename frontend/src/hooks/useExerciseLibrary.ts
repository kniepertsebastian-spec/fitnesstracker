import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateExerciseInput, UpdateExerciseInput } from "@fitnesstracker/shared";
import {
  createExerciseRequest,
  deleteExerciseRequest,
  getExerciseByIdRequest,
  getExerciseFacetsRequest,
  listExercisesRequest,
  updateExerciseRequest,
} from "../api/exercise.api";

const PAGE_SIZE = 30;

export interface ExerciseLibraryFilters {
  search: string;
  muscleGroup: string;
  equipment: string;
  includeInactive?: boolean;
}

export function useExerciseLibrary(filters: ExerciseLibraryFilters) {
  return useInfiniteQuery({
    queryKey: ["exercise-library", filters],
    queryFn: ({ pageParam }) =>
      listExercisesRequest({
        search: filters.search || undefined,
        muscleGroup: filters.muscleGroup || undefined,
        equipment: filters.equipment || undefined,
        includeInactive: filters.includeInactive,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
  });
}

export function useExerciseFacets() {
  return useQuery({
    queryKey: ["exercise-facets"],
    queryFn: getExerciseFacetsRequest,
    staleTime: Infinity,
  });
}

export function useExercise(id: string | undefined) {
  return useQuery({
    queryKey: ["exercise", id],
    queryFn: () => getExerciseByIdRequest(id as string),
    enabled: !!id,
  });
}

// Shared by all three mutations: a create/update/deactivate/delete changes what shows up in the
// library, the facets (new muscle/equipment values), the detail page, and every exercise picker
// elsewhere in the app (`useExercises()` in useWorkoutLogs.ts uses the plain "exercises" key).
function useInvalidateExerciseQueries() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["exercise-library"] });
    queryClient.invalidateQueries({ queryKey: ["exercise-facets"] });
    queryClient.invalidateQueries({ queryKey: ["exercise"] });
    queryClient.invalidateQueries({ queryKey: ["exercises"] });
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
    mutationFn: ({ id, input }: { id: string; input: UpdateExerciseInput }) =>
      updateExerciseRequest(id, input),
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
