import { Download } from "lucide-react";
import { useExportBackup, useExportWorkoutsCsv } from "../../hooks/useDataExport";
import { Button, Callout, Card } from "../ui";

// "Persönliche Trainingsdaten sollen nicht ausschließlich an die App gebunden sein" (roadmap
// additionals P1.6) — a full JSON backup (everything: workouts, goals, body metrics, training
// plan, supplements, settings) plus a CSV of just the workout logs for anyone who wants to open
// their training history directly in a spreadsheet rather than parse JSON.
export function DataExportCard() {
  const exportBackup = useExportBackup();
  const exportWorkoutsCsv = useExportWorkoutsCsv();

  return (
    <Card title="Export & Backup">
      <p className="text-small text-text-subtle">
        Eigene Trainingsdaten als Datei sichern — unabhängig von der App nutzbar.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <Button
          variant="primary"
          iconLeft={<Download size={16} aria-hidden />}
          disabled={exportBackup.isPending}
          onClick={() => exportBackup.mutate()}
        >
          {exportBackup.isPending ? "Erstelle Backup…" : "Vollständiges Backup (JSON)"}
        </Button>
        <Button
          variant="secondary"
          iconLeft={<Download size={16} aria-hidden />}
          disabled={exportWorkoutsCsv.isPending}
          onClick={() => exportWorkoutsCsv.mutate()}
        >
          {exportWorkoutsCsv.isPending ? "Erstelle CSV…" : "Trainingslog (CSV)"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-text-faint">
        Das JSON-Backup enthält Trainingslog, Ziele, Körperdaten, Trainingsplan, Supplements und
        Einstellungen. Fotos sind nur mit Datum enthalten, nicht als Bilddatei.
      </p>

      {(exportBackup.isError || exportWorkoutsCsv.isError) && (
        <Callout tone="danger" className="mt-3">
          Export fehlgeschlagen — bitte erneut versuchen.
        </Callout>
      )}
    </Card>
  );
}
