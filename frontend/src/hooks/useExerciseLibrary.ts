import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getExerciseByIdRequest, getExerciseFacetsRequest, listExercisesRequest } from "../api/exercise.api";

const PAGE_SIZE = 30;

export interface ExerciseLibraryFilters {
  search: string;
  muscleGroup: string;
  equipment: string;
}

export function useExerciseLibrary(filters: ExerciseLibraryFilters) {
  return useInfiniteQuery({
    queryKey: ["exercise-library", filters],
    queryFn: ({ pageParam }) =>
      listExercisesRequest({
        search: filters.search || undefined,
        muscleGroup: filters.muscleGroup || undefined,
        equipment: filters.equipment || undefined,
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
