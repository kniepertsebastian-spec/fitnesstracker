import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateSupplementInput, UpdateSupplementInput } from "@fitnesstracker/shared";
import {
  createSupplementRequest,
  deleteSupplementRequest,
  listSupplementsRequest,
  updateSupplementRequest,
} from "../api/supplement.api";

const SUPPLEMENTS_KEY = ["supplements"];

export function useSupplements() {
  return useQuery({
    queryKey: SUPPLEMENTS_KEY,
    queryFn: () => listSupplementsRequest().then((r) => r.items),
  });
}

export function useCreateSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupplementInput) => createSupplementRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLEMENTS_KEY }),
  });
}

export function useUpdateSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSupplementInput }) =>
      updateSupplementRequest(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLEMENTS_KEY }),
  });
}

export function useDeleteSupplement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSupplementRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLEMENTS_KEY }),
  });
}
