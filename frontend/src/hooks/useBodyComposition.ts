import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateBodyCompositionEntryInput, ImportBodyCompositionResult } from "@fitnesstracker/shared";
import {
  createBodyCompositionEntryRequest,
  deleteBodyCompositionEntryRequest,
  importBodyCompositionRequest,
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

const IMPORT_CHUNK = 500;

// Sends the parsed measurements in chunks the endpoint accepts and adds up the results.
export function useImportBodyComposition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: { measuredAt: string; weightKg: number; bodyFatPercent?: number }[]) => {
      const total: ImportBodyCompositionResult = { imported: 0, skipped: 0 };
      for (let i = 0; i < entries.length; i += IMPORT_CHUNK) {
        const result = await importBodyCompositionRequest({ entries: entries.slice(i, i + IMPORT_CHUNK) });
        total.imported += result.imported;
        total.skipped += result.skipped;
      }
      return total;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: BODY_COMPOSITION_KEY }),
  });
}
