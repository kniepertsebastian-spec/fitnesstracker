import type { ActivityReportDto, ImportActivityDaysInput, ImportActivityDaysResult } from "@fitnesstracker/shared";
import { apiFetch } from "./client";

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
