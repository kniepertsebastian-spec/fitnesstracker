import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, FileImage, LoaderCircle, ScanText, Sparkles, Upload, X } from "lucide-react";
import { ApiError } from "../../api/client";
import type { BodyAnalysisDraft, BodyAnalysisEntry, BodyAnalysisMetric } from "../../api/bodyAnalysis.api";
import { useAnalyzeBodyImage, useBodyAnalyses, useSaveBodyAnalysis } from "../../hooks/useBodyAnalysis";
import { Button, Callout, Card, EmptyState, Field, Input, Skeleton } from "../ui";

const confidenceLabel = { high: "Gut erkannt", medium: "Bitte prüfen", low: "Unsicher" } as const;
function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function shortDate(value: string) {
  return new Date(value).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function numberInput(value: number) { return String(value).replace(".", ","); }
function parseNumber(value: string) { return Number(value.replace(",", ".")); }

export function BodyAnalysisCard() {
  const { data: entries, isLoading } = useBodyAnalyses();
  const analyze = useAnalyzeBodyImage();
  const save = useSaveBodyAnalysis();
  const [draft, setDraft] = useState<BodyAnalysisDraft | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  async function onChoose(file?: File) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    try {
      setDraft(await analyze.mutateAsync(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Die Analyse konnte nicht erstellt werden.");
    }
  }
  function updateMetric(index: number, patch: Partial<BodyAnalysisMetric>) {
    setDraft((current) => current ? ({ ...current, metrics: current.metrics.map((metric, i) => i === index ? { ...metric, ...patch } : metric) }) : current);
  }
  async function saveDraft() {
    if (!draft) return;
    if (!draft.metrics.length || draft.metrics.some((m) => !m.label.trim() || !Number.isFinite(m.value))) {
      setError("Bitte prüfe die Messwerte. Jeder Wert braucht eine Bezeichnung und eine gültige Zahl.");
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(draft);
      setDraft(null);
      setFileName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Die Analyse konnte nicht gespeichert werden.");
    }
  }

  return <div className="flex flex-col gap-4">
    <Card title="Körperanalyse importieren" action={<span className="inline-flex items-center gap-1 text-xs text-text-subtle"><Sparkles size={14}/> KI-Auswertung</span>}>
      <p className="mb-3 text-small text-text-subtle">Lade einen Screenshot oder ein Foto deiner Körperanalyse hoch. Die Texterkennung läuft lokal auf dem Server; die erkannten Textwerte werden anschließend von deinem konfigurierten KI-Anbieter erklärt. Das Originalbild wird nicht dauerhaft gespeichert.</p>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-center hover:border-accent">
        {analyze.isPending ? <LoaderCircle size={24} className="animate-spin text-text-subtle"/> : <Upload size={24} className="text-text-subtle"/>}
        <span className="text-body font-medium">{analyze.isPending ? "Bild wird analysiert …" : "Bild auswählen"}</span>
        <span className="text-xs text-text-subtle">JPG, PNG oder WebP · maximal 10 MB</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={analyze.isPending} onChange={(event) => { void onChoose(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
      </label>
      {fileName && <p className="mt-2 flex items-center gap-2 text-xs text-text-subtle"><FileImage size={14}/>{fileName}</p>}
      {error && <Callout tone="danger" className="mt-3"><span className="inline-flex items-center gap-2"><AlertCircle size={16}/>{error}</span></Callout>}
    </Card>

    {draft && <Card title="Erkannte Werte prüfen" action={<button type="button" aria-label="Entwurf schließen" onClick={() => setDraft(null)} className="rounded-lg p-1 text-text-subtle hover:bg-surface-2"><X size={18}/></button>}>
      <div className="mb-4">
        <Field label="Messdatum">
          {(props) => <Input {...props} type="date" value={draft.measuredAt.slice(0, 10)} onChange={(event) => { if (event.target.value) setDraft({ ...draft, measuredAt: new Date(event.target.value + "T12:00:00").toISOString() }); }}/>}
        </Field>
      </div>
      <Field label="Gesamtbewertung">
        {(props) => <textarea {...props} className="min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-body text-text" value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })}/>}
      </Field>
      <div className="mt-4 flex flex-col gap-3">
        {draft.metrics.map((metric, index) => <div key={metric.key + index} className="rounded-xl border border-border p-3">
          <div className="grid grid-cols-[1fr_110px_75px] gap-2">
            <Field label="Messwert">
              {(props) => <Input {...props} value={metric.label} onChange={(event) => updateMetric(index, { label: event.target.value })}/>}
            </Field>
            <Field label="Wert">
              {(props) => <Input {...props} inputMode="decimal" value={numberInput(metric.value)} onChange={(event) => updateMetric(index, { value: parseNumber(event.target.value) })}/>}
            </Field>
            <Field label="Einheit">
              {(props) => <Input {...props} value={metric.unit} onChange={(event) => updateMetric(index, { unit: event.target.value })}/>}
            </Field>
          </div>
          <p className="mt-2 text-xs text-text-subtle">{confidenceLabel[metric.confidence]}</p>
          <Field label="Was bedeutet der Wert?">
            {(props) => <textarea {...props} className="min-h-16 w-full rounded-lg border border-border bg-surface px-3 py-2 text-small text-text" value={metric.explanation} onChange={(event) => updateMetric(index, { explanation: event.target.value })}/>}
          </Field>
          <Field label="Einordnung">
            {(props) => <textarea {...props} className="mt-2 min-h-16 w-full rounded-lg border border-border bg-surface px-3 py-2 text-small text-text" value={metric.assessment} onChange={(event) => updateMetric(index, { assessment: event.target.value })}/>}
          </Field>
        </div>)}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" size="lg" fullWidth onClick={saveDraft} disabled={save.isPending}>{save.isPending ? "Speichert …" : "Analyse speichern"}</Button>
        <Button variant="secondary" size="lg" fullWidth onClick={() => setDraft(null)}>Verwerfen</Button>
      </div>
    </Card>}

    <Card title="Gespeicherte Analysen">
      {isLoading ? <Skeleton className="h-24 w-full"/> : !entries?.length ? <EmptyState icon={<ScanText size={18}/>} text="Noch keine Körperanalyse importiert."/> :
        <div className="flex flex-col divide-y divide-border">
          {entries.map((entry, index) => <AnalysisHistoryItem key={entry.id} entry={entry} previous={entries[index + 1]} expanded={expanded === entry.id} onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}/>)}
        </div>}
    </Card>
  </div>;
}

function AnalysisHistoryItem({ entry, previous, expanded, onToggle }: { entry: BodyAnalysisEntry; previous?: BodyAnalysisEntry; expanded: boolean; onToggle: () => void }) {
  return <section className="py-3 first:pt-0 last:pb-0">
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left hover:bg-surface-2">
      <span className="min-w-0"><span className="block text-body font-medium text-text">{dateLabel(entry.measuredAt)}</span><span className="mt-1 block truncate text-xs text-text-subtle">{entry.metrics.slice(0, 4).map((m) => `${m.label}: ${m.value} ${m.unit}`).join(" · ")}</span></span>
      {expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
    </button>
    {expanded && <div className="mt-3 rounded-xl bg-surface-2 p-3">
      <p className="mb-3 text-small text-text-2">{entry.summary}</p>
      <div className="flex flex-col gap-3">{entry.metrics.map((metric) => {
        const old = previous?.metrics.find((m) => m.key === metric.key);
        const delta = old ? metric.value - old.value : null;
        return <div key={metric.key} className="border-b border-border/70 pb-3 last:border-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-medium text-text">{metric.label}</span><span className="text-body tabular-nums text-text">{metric.value} {metric.unit}{delta !== null && <span className="ml-2 text-xs text-text-subtle">({delta > 0 ? "+" : ""}{Number(delta.toFixed(2))} ggü. vorheriger Analyse)</span>}</span></div>
          <p className="mt-1 text-small text-text-subtle">{metric.explanation}</p>
          <p className="mt-1 text-small text-text-2">{metric.assessment}</p>
        </div>;
      })}</div>
      {entry.ocrText && <details className="mt-3"><summary className="cursor-pointer text-xs text-text-subtle">Erkannter Originaltext</summary><pre className="mt-2 whitespace-pre-wrap break-words text-xs text-text-subtle">{entry.ocrText}</pre></details>}
      {entry.sourceName && <p className="mt-3 text-xs text-text-faint">Datei: {entry.sourceName}</p>}
    </div>}
  </section>;
}
