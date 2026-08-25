import { useRef, useState } from "react";
import type { PlanExportFormat } from "@fitnesstracker/shared";
import { useExportPlan, useImportPlan } from "../../hooks/usePlanExport";

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
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="text-sm font-medium text-ink-300">Plan exportieren / importieren</p>
      <p className="mt-1 text-sm text-ink-500">
        Alle drei Phasen als Datei sichern oder aus einer zuvor exportierten Datei wiederherstellen.
      </p>

      <div className="mt-3 flex gap-1 rounded-lg border border-ink-800 bg-ink-950 p-1">
        {FORMATS.map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`flex-1 rounded-md py-1 text-xs font-medium uppercase ${
              format === f ? "bg-violet-500 text-ink-950" : "text-ink-400 hover:text-ink-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => exportPlan.mutate(format)}
          disabled={exportPlan.isPending}
          className="flex-1 rounded-lg bg-ink-800 py-1.5 text-sm font-medium text-ink-200 hover:bg-ink-700 disabled:opacity-50"
        >
          Exportieren
        </button>
        <button
          onClick={handleImportClick}
          disabled={importPlan.isPending}
          className="flex-1 rounded-lg bg-violet-500 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
        >
          {importPlan.isPending ? "Importiert…" : "Importieren"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={format === "csv" ? ".csv" : format === "json" ? ".json" : ".xml"}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {importPlan.isError && (
        <p className="mt-2 text-sm text-red-400">Import fehlgeschlagen — Datei/Format prüfen.</p>
      )}

      {importPlan.isSuccess && (
        <div className="mt-2 text-sm">
          <p className="text-emerald-400">
            {importPlan.data.created} neu, {importPlan.data.updated} aktualisiert.
          </p>
          {importPlan.data.errors.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-ink-500">
              {importPlan.data.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
