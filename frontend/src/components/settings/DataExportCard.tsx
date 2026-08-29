import { useExportBackup, useExportWorkoutsCsv } from "../../hooks/useDataExport";

// "Persönliche Trainingsdaten sollen nicht ausschließlich an die App gebunden sein" (roadmap
// additionals P1.6) — a full JSON backup (everything: workouts, goals, body metrics, training
// plan, supplements, settings) plus a CSV of just the workout logs for anyone who wants to open
// their training history directly in a spreadsheet rather than parse JSON.
export function DataExportCard() {
  const exportBackup = useExportBackup();
  const exportWorkoutsCsv = useExportWorkoutsCsv();

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="text-sm font-medium text-ink-300">Export &amp; Backup</p>
      <p className="mt-1 text-sm text-ink-500">
        Eigene Trainingsdaten als Datei sichern — unabhängig von der App nutzbar.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={() => exportBackup.mutate()}
          disabled={exportBackup.isPending}
          className="rounded-lg bg-violet-500 py-2 text-sm font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
        >
          {exportBackup.isPending ? "Erstelle Backup…" : "Vollständiges Backup (JSON)"}
        </button>
        <button
          onClick={() => exportWorkoutsCsv.mutate()}
          disabled={exportWorkoutsCsv.isPending}
          className="rounded-lg border border-ink-700 py-2 text-sm text-ink-300 hover:bg-ink-800 disabled:opacity-50"
        >
          {exportWorkoutsCsv.isPending ? "Erstelle CSV…" : "Trainingslog (CSV)"}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-600">
        Das JSON-Backup enthält Trainingslog, Ziele, Körperdaten, Trainingsplan, Supplements und
        Einstellungen. Fotos sind nur mit Datum enthalten, nicht als Bilddatei.
      </p>

      {(exportBackup.isError || exportWorkoutsCsv.isError) && (
        <p className="mt-2 text-sm text-red-400">Export fehlgeschlagen — bitte erneut versuchen.</p>
      )}
    </div>
  );
}
