import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImportActivityDaysInput } from "@fitnesstracker/shared";
import { activityReportRequest, importActivityDaysRequest } from "../api/activity.api";

export function useActivityReport(range: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["activity", "report", range.from ?? null, range.to ?? null],
    queryFn: () => activityReportRequest(range),
  });
}

export function useImportActivityDays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportActivityDaysInput) => importActivityDaysRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity"] }),
  });
}
