import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCardioLogInput } from "@fitnesstracker/shared";
import {
  createCardioLogRequest,
  deleteCardioLogRequest,
  listTodayCardioLogsRequest,
} from "../api/cardioLog.api";

const CARDIO_LOGS_KEY = ["cardio-logs", "today"];

export function useTodayCardioLogs() {
  return useQuery({
    queryKey: CARDIO_LOGS_KEY,
    queryFn: () => listTodayCardioLogsRequest().then((r) => r.items),
  });
}

export function useCreateCardioLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardioLogInput) => createCardioLogRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CARDIO_LOGS_KEY }),
  });
}

export function useDeleteCardioLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCardioLogRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CARDIO_LOGS_KEY }),
  });
}
