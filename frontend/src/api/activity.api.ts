import type { ActivityReport, HealthSyncStatusDto, HealthSyncTokenCreatedDto } from "@fitnesstracker/shared";
import { apiFetch, apiFetchBlob } from "./client";

const query = (weeks: number, timeZone: string) => `weeks=${weeks}&tz=${encodeURIComponent(timeZone)}`;

export function getHealthSyncStatusRequest() {
  return apiFetch<HealthSyncStatusDto>("/health-sync/status");
}

export function createHealthSyncTokenRequest() {
  return apiFetch<HealthSyncTokenCreatedDto>("/health-sync/token", { method: "POST" });
}

export function revokeHealthSyncTokenRequest() {
  return apiFetch<void>("/health-sync/token", { method: "DELETE" });
}

export function getActivityReportRequest(weeks: number, timeZone: string) {
  return apiFetch<ActivityReport>(`/activity/report?${query(weeks, timeZone)}`);
}

export function exportActivityRequest(format: "json" | "pdf", weeks: number, timeZone: string) {
  return apiFetchBlob(`/export/activity.${format}?${query(weeks, timeZone)}`);
}
