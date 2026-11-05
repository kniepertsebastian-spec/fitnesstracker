import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CardioPlanDto,
  ResetCardioPlanInput,
  SaveCardioPlanDayInput,
  SaveCardioPlanFreeInput,
  TrainingPhase,
} from "@fitnesstracker/shared";
import {
  getCardioPlanRequest,
  resetCardioPlanRequest,
  saveCardioPlanDayRequest,
  saveCardioPlanFreeRequest,
} from "../api/cardioPlan.api";

export const cardioPlanKey = (phase: TrainingPhase) => ["cardio", "plan", phase];

export function useCardioPlan(phase: TrainingPhase | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: cardioPlanKey(phase ?? "AUFBAU"),
    queryFn: () => getCardioPlanRequest(phase),
    enabled: !!phase && (options?.enabled ?? true),
  });
}

// Plan edits are online-only, like the other plan settings (pause, +1 Woche, remarks).
function useCardioPlanWrite<T extends { phase: TrainingPhase }>(request: (input: T) => Promise<CardioPlanDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (plan) => queryClient.setQueryData(cardioPlanKey(plan.phase), plan),
  });
}

export const useSaveCardioPlanDay = () => useCardioPlanWrite<SaveCardioPlanDayInput>(saveCardioPlanDayRequest);
export const useSaveCardioPlanFree = () => useCardioPlanWrite<SaveCardioPlanFreeInput>(saveCardioPlanFreeRequest);
export const useResetCardioPlan = () => useCardioPlanWrite<ResetCardioPlanInput>(resetCardioPlanRequest);
