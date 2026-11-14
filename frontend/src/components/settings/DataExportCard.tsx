import { Download, Upload } from "lucide-react";
import { useRef } from "react";
import type { BackupImportResult } from "@fitnesstracker/shared";
import { useExportBackup, useExportWorkoutsCsv, useImportBackup } from "../../hooks/useDataExport";
import { Button, Callout, Card } from "../ui";

// "Persönliche Trainingsdaten sollen nicht ausschließlich an die App gebunden sein" (roadmap
// additionals P1.6) — a full JSON backup (everything: workouts, goals, body metrics, training
// plan, supplements, settings) plus a CSV of just the workout logs for anyone who wants to open
// their training history directly in a spreadsheet rather than parse JSON.
export function DataExportCard() {
  const exportBackup = useExportBackup();
  const exportWorkoutsCsv = useExportWorkoutsCsv();
  const importBackup = useImportBackup();
  const fileInput = useRef<HTMLInputElement>(null);

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

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-body font-medium text-text">Sicherung einspielen</h3>
        <p className="mt-1 text-small text-text-subtle">
          Stellt eine Datei aus „Vollständiges Backup (JSON)“ wieder her. Das geht nur in ein leeres Konto: Lege ein neues
          Konto an und spiele die Sicherung dort ein.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Sicherungsdatei (JSON) auswählen"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) importBackup.mutate(file);
          }}
        />
        <Button
          className="mt-3"
          variant="secondary"
          iconLeft={<Upload size={16} aria-hidden />}
          disabled={importBackup.isPending}
          onClick={() => fileInput.current?.click()}
        >
          {importBackup.isPending ? "Spiele Sicherung ein…" : "Sicherung einspielen (JSON)"}
        </Button>
        {importBackup.isError && (
          <Callout tone="danger" className="mt-3">
            {importBackup.error.message}
          </Callout>
        )}
        {importBackup.isSuccess && (
          <Callout tone="info" className="mt-3">
            {importSummary(importBackup.data)}
          </Callout>
        )}
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

const SECTION_LABELS: Record<string, string> = {
  workoutLogs: "Sätze",
  planExercises: "Planübungen",
  goals: "Ziele",
  bodyCompositionEntries: "Körpermessungen",
  bodyFatCalibrations: "Kalibrierungen",
  cardioLogs: "Cardio-Einträge",
  supplements: "Supplements",
  dailyActivities: "Schritt-Tage",
  cyclingSessions: "Radfahrten",
};

function importSummary(result: BackupImportResult): string {
  const parts = Object.entries(SECTION_LABELS)
    .filter(([key]) => (result.imported[key] ?? 0) > 0)
    .map(([key, label]) => `${result.imported[key]} ${label}`);
  const skipped = Object.values(result.skipped).reduce((sum, n) => sum + n, 0);
  let text = parts.length > 0 ? `Eingespielt: ${parts.join(", ")}.` : "Die Sicherung enthielt keine Daten zum Einspielen.";
  if (skipped > 0) text += ` ${skipped} unvollständige Einträge wurden übersprungen.`;
  if (result.createdExercises > 0) text += ` ${result.createdExercises} eigene Übungen wurden neu angelegt.`;
  if (result.photosNotImported > 0) text += ` ${result.photosNotImported} Fortschrittsfotos sind nicht dabei, die Bilddateien fehlen im Backup.`;
  return text;
}
