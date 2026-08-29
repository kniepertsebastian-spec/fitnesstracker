import { useMutation } from "@tanstack/react-query";
import { exportBackupJsonRequest, exportWorkoutsCsvRequest } from "../api/dataExport.api";

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
