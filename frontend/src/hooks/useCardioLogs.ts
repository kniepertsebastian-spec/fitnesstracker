import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CARDIO_MACHINE_LABELS, type CreateCardioLogInput } from "@fitnesstracker/shared";
import { createCardioLogLocal } from "../offline/cardioLogSync";
import {
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

// Goes through the offline queue (F9): resolves as soon as the entry is stored locally; the queue
// syncs it and refreshes the cardio queries once the server has it.
export function useCreateCardioLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardioLogInput) =>
      createCardioLogLocal(
        { ...input, clientId: input.clientId ?? crypto.randomUUID(), performedAt: input.performedAt ?? new Date().toISOString() },
        `Cardio · ${CARDIO_MACHINE_LABELS[input.machine]}`,
      ),
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
