import type {
  ActivityReport,
  ActivityReportDto,
  HealthSyncStatusDto,
  HealthSyncTokenCreatedDto,
  ImportActivityDaysInput,
  ImportActivityDaysResult
} from "@fitnesstracker/shared";
import { apiFetch, apiFetchBlob } from "./client";

const weekQuery = (weeks: number, timeZone: string) => `weeks=${weeks}&tz=${encodeURIComponent(timeZone)}`;

// Health Connect sync
export function getHealthSyncStatusRequest() {
  return apiFetch<HealthSyncStatusDto>("/health-sync/status");
}

export function createHealthSyncTokenRequest() {
  return apiFetch<HealthSyncTokenCreatedDto>("/health-sync/token", { method: "POST" });
}

export function revokeHealthSyncTokenRequest() {
  return apiFetch<void>("/health-sync/token", { method: "DELETE" });
}

// Insurance report (date range based)
export function activityReportRequest(range: { from?: string; to?: string }) {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const query = params.toString();
  return apiFetch<ActivityReportDto>(`/activity/report${query ? `?${query}` : ""}`);
}

export function importActivityDaysRequest(input: ImportActivityDaysInput) {
  return apiFetch<ImportActivityDaysResult>("/activity/import", { method: "POST", body: input });
}

// Weekly comprehensive report
export function getWeeklyActivityReportRequest(weeks: number, timeZone: string) {
  return apiFetch<ActivityReport>(`/activity/weekly-report?${weekQuery(weeks, timeZone)}`);
}

export function exportActivityRequest(format: "json" | "pdf", weeks: number, timeZone: string) {
  return apiFetchBlob(`/export/activity.${format}?${weekQuery(weeks, timeZone)}`);
}
