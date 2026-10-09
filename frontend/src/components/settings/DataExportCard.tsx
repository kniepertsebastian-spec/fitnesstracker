import { useExportBackup, useExportWorkoutsCsv } from "../../hooks/useDataExport";

// "Persönliche Trainingsdaten sollen nicht ausschließlich an die App gebunden sein" (roadmap
// additionals P1.6) — a full JSON backup (everything: workouts, goals, body metrics, training
// plan, supplements, settings) plus a CSV of just the workout logs for anyone who wants to open
// their training history directly in a spreadsheet rather than parse JSON.
export function DataExportCard() {
  const exportBackup = useExportBackup();
  const exportWorkoutsCsv = useExportWorkoutsCsv();

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-medium text-text-muted">Export &amp; Backup</p>
      <p className="mt-1 text-sm text-text-faint">
        Eigene Trainingsdaten als Datei sichern — unabhängig von der App nutzbar.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={() => exportBackup.mutate()}
          disabled={exportBackup.isPending}
          className="rounded-lg bg-accent py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {exportBackup.isPending ? "Erstelle Backup…" : "Vollständiges Backup (JSON)"}
        </button>
        <button
          onClick={() => exportWorkoutsCsv.mutate()}
          disabled={exportWorkoutsCsv.isPending}
          className="rounded-lg border border-border-strong py-2 text-sm text-text-muted hover:bg-surface-2 disabled:opacity-50"
        >
          {exportWorkoutsCsv.isPending ? "Erstelle CSV…" : "Trainingslog (CSV)"}
        </button>
      </div>

      <p className="mt-3 text-xs text-text-faint">
        Das JSON-Backup enthält Trainingslog, Ziele, Körperdaten, Trainingsplan, Supplements und
        Einstellungen. Fotos sind nur mit Datum enthalten, nicht als Bilddatei.
      </p>

      {(exportBackup.isError || exportWorkoutsCsv.isError) && (
        <p className="mt-2 text-sm text-danger-text">Export fehlgeschlagen — bitte erneut versuchen.</p>
      )}
    </div>
  );
}
