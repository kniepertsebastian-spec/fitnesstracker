import { useRef, useState } from "react";
import { TRAINING_PHASE_ROTATION, TRAINING_PHASE_LABELS } from "@fitnesstracker/shared";
import type { PlanExportFormat, PlanImportMode, PlanImportPreview, TrainingPhase } from "@fitnesstracker/shared";
import { useExportPlan, useImportPlan, usePreviewPlanImport } from "../../hooks/usePlanExport";
import { useTrainingPlan } from "../../hooks/useTrainingPlan";
import { Button, Callout, Card, Field, SegmentedControl, Select } from "../ui";

const FORMATS: PlanExportFormat[] = ["csv", "json", "xml"];
const WHOLE_PLAN = "";
const ALL_PHASES = "all";

interface Pending {
  file: File;
  preview: PlanImportPreview;
}

// Export and import of the training plan — the whole plan or a single phase. A phase can be taken over
// into any phase of the plan; only the entries are written, the rotation (current phase, week) is left alone.
export function PlanExportImportCard() {
  const { data: plan } = useTrainingPlan();
  const [format, setFormat] = useState<PlanExportFormat>("json");
  const [exportPhase, setExportPhase] = useState<string>(WHOLE_PLAN);
  const exportPlan = useExportPlan();
  const previewImport = usePreviewPlanImport();
  const importPlan = useImportPlan();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [source, setSource] = useState<string>(ALL_PHASES);
  const [target, setTarget] = useState<TrainingPhase>("AUFBAU");
  const [mode, setMode] = useState<PlanImportMode>("merge");

  const phases =
    plan?.phases && plan.phases.length > 0
      ? plan.phases
      : TRAINING_PHASE_ROTATION.map((phase) => ({ phase, label: TRAINING_PHASE_LABELS[phase], isDaily: false }));
  const labelOf = (phase: string) => phases.find((p) => p.phase === phase)?.label ?? TRAINING_PHASE_LABELS[phase as TrainingPhase] ?? phase;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    importPlan.reset();
    previewImport.mutate(
      { file, format },
      {
        onSuccess: (preview) => {
          setPending({ file, preview });
          // One phase in the file: it is the source. Several: default to taking them all over 1:1.
          const only = preview.phases.length === 1 ? preview.phases[0].phase : null;
          setSource(only ?? ALL_PHASES);
          const first = only ?? preview.phases[0]?.phase;
          setTarget(phases.some((p) => p.phase === first) ? (first as TrainingPhase) : (plan?.currentPhase ?? phases[0].phase));
          setMode("merge");
        },
      },
    );
  };

  const singleSource = source !== ALL_PHASES;
  const selectedCount = pending
    ? singleSource
      ? (pending.preview.phases.find((p) => p.phase === source)?.count ?? 0)
      : pending.preview.phases.reduce((sum, p) => sum + p.count, 0)
    : 0;

  const runImport = () => {
    if (!pending) return;
    importPlan.mutate(
      {
        file: pending.file,
        format,
        options: {
          sourcePhase: singleSource ? (source as TrainingPhase) : undefined,
          targetPhase: singleSource ? target : undefined,
          mode,
        },
      },
      { onSuccess: () => setPending(null) },
    );
  };

  return (
    <Card title="Plan exportieren / importieren">
      <p className="text-small text-text-subtle">
        Den ganzen Plan oder eine einzelne Phase als Datei sichern. Eine Phase lässt sich in jede Phase übernehmen,
        ohne dass sich Phasenwoche oder Rotation ändern.
      </p>

      <SegmentedControl
        label="Dateiformat"
        className="mt-3"
        value={format}
        onChange={setFormat}
        options={FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
      />

      <div className="mt-3">
        <Field label="Exportieren">
          {(p) => (
            <Select {...p} value={exportPhase} onChange={(e) => setExportPhase(e.target.value)}>
              <option value={WHOLE_PLAN}>Ganzer Plan (alle Phasen)</option>
              {phases.map((ph) => (
                <option key={ph.phase} value={ph.phase}>
                  Nur Phase „{ph.label}“
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={exportPlan.isPending}
          onClick={() => exportPlan.mutate({ format, phase: exportPhase ? (exportPhase as TrainingPhase) : undefined })}
        >
          Exportieren
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={previewImport.isPending || importPlan.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {previewImport.isPending ? "Liest Datei…" : "Datei importieren"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={format === "csv" ? ".csv" : format === "json" ? ".json" : ".xml"}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {previewImport.isError && (
        <Callout tone="danger" className="mt-3">
          Datei konnte nicht gelesen werden — Datei und Format prüfen.
        </Callout>
      )}

      {pending && (
        <div className="mt-4 rounded-xl border border-accent-border bg-bg p-4">
          <p className="text-body font-medium text-text">{pending.file.name}</p>
          {pending.preview.phases.length === 0 ? (
            <p className="mt-1 text-small text-text-subtle">In der Datei wurden keine Übungen gefunden.</p>
          ) : (
            <ul className="mt-1 text-small text-text-subtle">
              {pending.preview.phases.map((p) => (
                <li key={p.phase}>
                  {labelOf(p.phase)}: {p.count} {p.count === 1 ? "Übung" : "Übungen"}
                  {p.days.length > 0 ? ` · ${p.days.length} ${p.days.length === 1 ? "Tag" : "Tage"}` : ""}
                </li>
              ))}
            </ul>
          )}

          {pending.preview.phases.length > 0 && (
            <div className="mt-3 flex flex-col gap-3">
              {pending.preview.phases.length > 1 && (
                <Field label="Was übernehmen?">
                  {(p) => (
                    <Select {...p} value={source} onChange={(e) => setSource(e.target.value)}>
                      <option value={ALL_PHASES}>Alle Phasen (jeweils in dieselbe Phase)</option>
                      {pending.preview.phases.map((ph) => (
                        <option key={ph.phase} value={ph.phase}>
                          Nur „{labelOf(ph.phase)}“
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              {singleSource && (
                <Field label="In welche Phase?">
                  {(p) => (
                    <Select {...p} value={target} onChange={(e) => setTarget(e.target.value as TrainingPhase)}>
                      {phases.map((ph) => (
                        <option key={ph.phase} value={ph.phase}>
                          {ph.label}
                          {ph.phase === plan?.currentPhase ? " (aktuell)" : ""}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              <SegmentedControl
                label="Vorgehen"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "merge", label: "Zusammenführen" },
                  { value: "replace", label: "Ersetzen" },
                ]}
              />
              <p className="text-xs text-text-subtle">
                {mode === "merge"
                  ? "Gleiche Übungen am selben Tag werden aktualisiert, neue kommen dazu, nichts wird gelöscht."
                  : `Die Übungen ${singleSource ? `der Phase „${labelOf(target)}“` : "der betroffenen Phasen"} werden vorher gelöscht und durch die Datei ersetzt.`}
              </p>
              {mode === "replace" && (
                <Callout tone="warning">
                  Ersetzen löscht die bisherigen Plan-Einträge dieser Phase. Dein Trainingsverlauf bleibt erhalten.
                </Callout>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setPending(null)}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={importPlan.isPending || selectedCount === 0}
              onClick={runImport}
            >
              {importPlan.isPending ? "Importiert…" : `${selectedCount} ${selectedCount === 1 ? "Übung" : "Übungen"} importieren`}
            </Button>
          </div>
        </div>
      )}

      {importPlan.isError && (
        <Callout tone="danger" className="mt-3">
          Import fehlgeschlagen — {importPlan.error instanceof Error ? importPlan.error.message : "Datei/Format prüfen"}.
        </Callout>
      )}

      {importPlan.isSuccess && (
        <Callout tone="info" className="mt-3">
          <p>
            {importPlan.data.created} neu, {importPlan.data.updated} aktualisiert
            {importPlan.data.deleted > 0 ? `, ${importPlan.data.deleted} ersetzt` : ""}.
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
