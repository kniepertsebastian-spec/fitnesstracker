import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateCardioLogInput } from "@fitnesstracker/shared";
import {
  createCardioLogRequest,
  deleteCardioLogRequest,
  listTodayCardioLogsRequest,
  listWeekCardioLogsRequest,
} from "../api/cardioLog.api";

const CARDIO_LOGS_KEY = ["cardio-logs", "today"];
const CARDIO_WEEK_KEY = ["cardio-logs", "week"];

export function useTodayCardioLogs() {
  return useQuery({
    queryKey: CARDIO_LOGS_KEY,
    queryFn: () => listTodayCardioLogsRequest().then((r) => r.items),
  });
}

export function useWeekCardioLogs() {
  return useQuery({
    queryKey: CARDIO_WEEK_KEY,
    queryFn: () => listWeekCardioLogsRequest().then((r) => r.items),
  });
}

export function useCreateCardioLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardioLogInput) => createCardioLogRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cardio-logs"] }),
  });
}

export function useDeleteCardioLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCardioLogRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cardio-logs"] }),
  });
}
