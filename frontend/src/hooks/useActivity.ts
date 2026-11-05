import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImportActivityDaysInput } from "@fitnesstracker/shared";
import {
  activityReportRequest,
  createHealthSyncTokenRequest,
  exportActivityRequest,
  getWeeklyActivityReportRequest,
  getHealthSyncStatusRequest,
  importActivityDaysRequest,
  revokeHealthSyncTokenRequest,
} from "../api/activity.api";

const SYNC_STATUS_KEY = ["health-sync", "status"];
const ACTIVITY_KEY = ["activity"];

// Days are cut at the viewer's local midnight, so the server needs to know where that is.
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  } catch {
    return "Europe/Berlin";
  }
}

// Health Connect sync
export function useHealthSyncStatus() {
  return useQuery({ queryKey: SYNC_STATUS_KEY, queryFn: getHealthSyncStatusRequest });
}

export function useCreateHealthSyncToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createHealthSyncTokenRequest,
    onSuccess: ({ status }) => queryClient.setQueryData(SYNC_STATUS_KEY, status),
  });
}

export function useRevokeHealthSyncToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeHealthSyncTokenRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SYNC_STATUS_KEY }),
  });
}

// Insurance report (date range based)
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

// Weekly comprehensive report
// The phone pushes new Health Connect data in the background, so the card re-reads every few
// minutes and whenever the app comes back to the foreground (react-query's default).
export function useWeeklyActivityReport(weeks: number) {
  return useQuery({
    queryKey: [...ACTIVITY_KEY, "weekly", weeks],
    queryFn: () => getWeeklyActivityReportRequest(weeks, browserTimeZone()),
    refetchInterval: 5 * 60 * 1000,
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function useExportActivity() {
  return useMutation({
    mutationFn: async ({ format, weeks }: { format: "json" | "pdf"; weeks: number }) => {
      const blob = await exportActivityRequest(format, weeks, browserTimeZone());
      downloadBlob(blob, `aktivitaet-${new Date().toISOString().slice(0, 10)}.${format}`);
    },
  });
}
