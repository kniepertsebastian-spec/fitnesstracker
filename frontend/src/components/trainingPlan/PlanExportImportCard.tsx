import { useRef, useState } from "react";
import type { PlanExportFormat } from "@fitnesstracker/shared";
import { useExportPlan, useImportPlan } from "../../hooks/usePlanExport";
import { Button, Callout, Card, SegmentedControl } from "../ui";

const FORMATS: PlanExportFormat[] = ["csv", "json", "xml"];

export function PlanExportImportCard() {
  const [format, setFormat] = useState<PlanExportFormat>("json");
  const exportPlan = useExportPlan();
  const importPlan = useImportPlan();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    importPlan.mutate({ file, format });
  };

  return (
    <Card title="Plan exportieren / importieren">
      <p className="text-small text-text-subtle">
        Alle drei Phasen als Datei sichern oder aus einer zuvor exportierten Datei wiederherstellen.
      </p>

      <SegmentedControl
        label="Dateiformat"
        className="mt-3"
        value={format}
        onChange={setFormat}
        options={FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
      />

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={exportPlan.isPending} onClick={() => exportPlan.mutate(format)}>
          Exportieren
        </Button>
        <Button variant="primary" className="flex-1" disabled={importPlan.isPending} onClick={handleImportClick}>
          {importPlan.isPending ? "Importiert…" : "Importieren"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={format === "csv" ? ".csv" : format === "json" ? ".json" : ".xml"}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {importPlan.isError && (
        <Callout tone="danger" className="mt-3">
          Import fehlgeschlagen — Datei/Format prüfen.
        </Callout>
      )}

      {importPlan.isSuccess && (
        <Callout tone="info" className="mt-3">
          <p>
            {importPlan.data.created} neu, {importPlan.data.updated} aktualisiert.
          </p>
          {importPlan.data.errors.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-text-subtle">
              {importPlan.data.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}
        </Callout>
      )}
    </Card>
  );
}
