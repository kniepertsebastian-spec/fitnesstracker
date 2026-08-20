import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addWaterRequest, getWaterStatusRequest, setWaterTargetRequest } from "../api/water.api";

const WATER_KEY = ["water"];

export function useWaterStatus() {
  return useQuery({
    queryKey: WATER_KEY,
    queryFn: getWaterStatusRequest,
  });
}

export function useAddWater() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (amountMl: number) => addWaterRequest({ amountMl }),
    onSuccess: (data) => queryClient.setQueryData(WATER_KEY, data),
  });
}

export function useSetWaterTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetMl: number | null) => setWaterTargetRequest({ targetMl }),
    onSuccess: (data) => queryClient.setQueryData(WATER_KEY, data),
  });
}
