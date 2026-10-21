import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { useImportBodyComposition } from "../../hooks/useBodyComposition";
import { readHealthFile, type HealthMeasurement } from "../../lib/healthImport";
import { formatKg } from "../../lib/trainingSets";
import { Button, Callout, Card } from "../ui";

const dateText = (iso: string) => new Date(iso).toLocaleDateString("de-DE");

// Weight and body fat from a health-app export file. A web app cannot read Apple Health, Samsung
// Health or Health Connect directly (those are on-device APIs of native apps), so the data comes
// in through the export file the apps offer. The file is read in the browser; only after the
// preview is confirmed are the measurements sent.
export function HealthImportCard() {
  const input = useRef<HTMLInputElement>(null);
  const importMeasurements = useImportBodyComposition();
  const [reading, setReading] = useState(false);
  const [measurements, setMeasurements] = useState<HealthMeasurement[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setMeasurements(null);
    setFileName(file.name);
    setReading(true);
    try {
      const parsed = await readHealthFile(file);
      if (parsed.length === 0) setError("In dieser Datei wurden keine Gewichtsmessungen gefunden.");
      else setMeasurements(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Die Datei konnte nicht gelesen werden.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  };

  const confirm = async () => {
    if (!measurements) return;
    setError(null);
    try {
      const { imported, skipped } = await importMeasurements.mutateAsync(measurements);
      setResult(
        `${imported} Messungen importiert${skipped > 0 ? `, ${skipped} waren schon vorhanden` : ""}.`,
      );
      setMeasurements(null);
    } catch {
      setError("Der Import ist fehlgeschlagen. Es wurde nichts doppelt gespeichert, du kannst es erneut versuchen.");
    }
  };

  const first = measurements?.[0];
  const last = measurements?.at(-1);
  const withFat = measurements?.filter((m) => m.bodyFatPercent !== undefined).length ?? 0;

  return (
    <Card title="Gesundheitsdaten importieren">
      <p className="text-small text-text-subtle">
        Körpergewicht (und Körperfett, falls enthalten) aus Apple Health, Samsung Health oder Google Fit übernehmen.
        Direkt verbinden kann sich eine Web-App mit diesen Apps nicht, deshalb über die Exportdatei:
      </p>
      <ul className="mt-2 list-disc pl-5 text-small text-text-subtle">
        <li>
          <span className="text-text-2">Apple Health:</span> Health-App → Profilbild → „Alle Gesundheitsdaten exportieren“ →
          export.zip
        </li>
        <li>
          <span className="text-text-2">Samsung Health:</span> Einstellungen → „Persönliche Daten herunterladen“ → ZIP
        </li>
        <li>
          <span className="text-text-2">Google Fit:</span> Google Takeout → Fit → CSV (oder jede CSV mit Datum und Gewicht)
        </li>
      </ul>

      <input
        ref={input}
        type="file"
        accept=".zip,.xml,.csv,.txt"
        className="sr-only"
        aria-label="Export-Datei wählen"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      <Button
        className="mt-3"
        variant="secondary"
        iconLeft={<FileUp size={16} aria-hidden />}
        disabled={reading || importMeasurements.isPending}
        onClick={() => input.current?.click()}
      >
        {reading ? "Lese Datei…" : "Export-Datei wählen"}
      </Button>

      {measurements && first && last && (
        <Callout tone="info" className="mt-3">
          <p>
            <span className="font-medium">{measurements.length} Messungen</span> in {fileName} gefunden (
            {dateText(first.measuredAt)} – {dateText(last.measuredAt)}), davon {withFat} mit Körperfett. Zuletzt:{" "}
            {formatKg(Math.round(last.weightKg * 10) / 10)} kg am {dateText(last.measuredAt)}.
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="primary" disabled={importMeasurements.isPending} onClick={() => void confirm()}>
              {importMeasurements.isPending ? "Importiere…" : "Importieren"}
            </Button>
            <Button variant="ghost" disabled={importMeasurements.isPending} onClick={() => setMeasurements(null)}>
              Verwerfen
            </Button>
          </div>
        </Callout>
      )}
      {result && (
        <Callout tone="info" className="mt-3">
          {result}
        </Callout>
      )}
      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
    </Card>
  );
}
