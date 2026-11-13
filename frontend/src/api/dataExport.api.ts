import type { BackupImportResult } from "@fitnesstracker/shared";
import { apiFetch, apiFetchBlob } from "./client";

export function exportBackupJsonRequest() {
  return apiFetchBlob("/export/backup.json");
}

export function exportWorkoutsCsvRequest() {
  return apiFetchBlob("/export/workouts.csv");
}

export function importBackupJsonRequest(backup: unknown) {
  return apiFetch<BackupImportResult>("/import/backup.json", { method: "POST", body: backup });
}
