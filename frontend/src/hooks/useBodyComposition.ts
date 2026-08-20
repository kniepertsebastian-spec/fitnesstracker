import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateBodyCompositionEntryInput } from "@fitnesstracker/shared";
import {
  createBodyCompositionEntryRequest,
  deleteBodyCompositionEntryRequest,
  listBodyCompositionEntriesRequest,
} from "../api/bodyComposition.api";

const BODY_COMPOSITION_KEY = ["body-composition"];

export function useBodyCompositionEntries() {
  return useQuery({
    queryKey: BODY_COMPOSITION_KEY,
    queryFn: () => listBodyCompositionEntriesRequest().then((r) => r.items),
  });
}

export function useCreateBodyCompositionEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBodyCompositionEntryInput) => createBodyCompositionEntryRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BODY_COMPOSITION_KEY }),
  });
}

export function useDeleteBodyCompositionEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBodyCompositionEntryRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BODY_COMPOSITION_KEY }),
  });
}
