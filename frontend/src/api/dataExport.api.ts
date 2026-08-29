import { apiFetchBlob } from "./client";

export function exportBackupJsonRequest() {
  return apiFetchBlob("/export/backup.json");
}

export function exportWorkoutsCsvRequest() {
  return apiFetchBlob("/export/workouts.csv");
}
