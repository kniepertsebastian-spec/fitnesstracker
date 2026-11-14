import { useMutation, useQueryClient } from "@tanstack/react-query";
import { exportBackupJsonRequest, exportWorkoutsCsvRequest, importBackupJsonRequest } from "../api/dataExport.api";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function todayFileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useExportBackup() {
  return useMutation({
    mutationFn: async () => {
      const blob = await exportBackupJsonRequest();
      downloadBlob(blob, `fitnesstracker-backup-${todayFileStamp()}.json`);
    },
  });
}

export function useExportWorkoutsCsv() {
  return useMutation({
    mutationFn: async () => {
      const blob = await exportWorkoutsCsvRequest();
      downloadBlob(blob, `workouts-${todayFileStamp()}.csv`);
    },
  });
}

// Restores a file written by the backup export into an empty account. Everything the app has
// cached is stale afterwards, so all queries are refetched.
export function useImportBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("Die Datei ist keine gültige JSON-Datei. Wähle die Sicherung aus „Vollständiges Backup (JSON)“.");
      }
      return importBackupJsonRequest(parsed);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
