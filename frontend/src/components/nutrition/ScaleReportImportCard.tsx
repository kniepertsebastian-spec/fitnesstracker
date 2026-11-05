import { useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, TriangleAlert, Upload, X } from "lucide-react";
import type { ScaleReportDraft } from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { browserTimeZone } from "../../hooks/useActivity";
import { useParseScaleReport, useSaveScaleReport } from "../../hooks/useBodyComposition";
import { draftToTexts, REPORT_FIELDS, textsToInput, type ReportField } from "../../lib/scaleReportForm";
import { CalcInfoButton } from "../info/CalcInfoButton";
import { Button, Callout, Card, Field, Input } from "../ui";

const SECTIONS: { id: ReportField["section"]; title: string; columns: string }[] = [
  { id: "main", title: "Hauptwerte", columns: "grid-cols-2" },
  { id: "more", title: "Weitere Werte", columns: "grid-cols-2" },
  { id: "imp20", title: "Impedanz bei 20 kHz", columns: "grid-cols-2" },
  { id: "imp100", title: "Impedanz bei 100 kHz", columns: "grid-cols-2" },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

// Reads a Fitdays report screenshot without AI and keeps every number of it, including the raw
// impedances, so the scale analysis can study how the values come about. The values are shown for
// correction before anything is saved: OCR occasionally misreads a digit.
export function ScaleReportImportCard() {
  const parse = useParseScaleReport();
  const save = useSaveScaleReport();
  const [draft, setDraft] = useState<ScaleReportDraft | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function onChoose(file?: File) {
    if (!file) return;
    setError(null);
    setSaved(null);
    try {
      const result = await parse.mutateAsync({ file, timeZone: browserTimeZone() });
      setDraft(result);
      setTexts(draftToTexts(result));
    } catch (err) {
      setDraft(null);
      setError(err instanceof ApiError ? err.message : "Der Bericht konnte nicht gelesen werden.");
    }
  }

  async function onSave() {
    if (!draft) return;
    const result = textsToInput(draft, texts);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(result.input);
      setSaved(`Gespeichert: Messung vom ${when(result.input.measuredAt)}.`);
      setDraft(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Die Messung konnte nicht gespeichert werden.");
    }
  }

  const failed = draft?.checks.filter((c) => !c.ok) ?? [];
  const uncertain = new Set(draft?.uncertain ?? []);

  return (
    <Card title="Waagenbericht einlesen" action={<CalcInfoButton id="scale-analysis" />}>
      <p className="text-small text-text-subtle">
        Screenshot des Fitdays-Berichts hochladen. Die Werte werden direkt aus dem Bild gelesen (ohne KI) und mit allen
        Zahlen gespeichert, auch den Impedanzen. Daraus entsteht die Waagen-Analyse weiter unten.
      </p>
      <label className="mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-5 text-center hover:border-accent">
        {parse.isPending ? <LoaderCircle size={22} className="animate-spin text-text-subtle" aria-hidden /> : <Upload size={22} className="text-text-subtle" aria-hidden />}
        <span className="text-body font-medium">{parse.isPending ? "Bericht wird gelesen …" : "Bild auswählen"}</span>
        <span className="text-xs text-text-subtle">JPG, PNG oder WebP · der ganze Bericht, scharf</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={parse.isPending}
          onChange={(event) => {
            void onChoose(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>

      {saved && (
        <Callout tone="info" className="mt-3">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} aria-hidden />
            {saved}
          </span>
        </Callout>
      )}
      {error && (
        <Callout tone="danger" className="mt-3">
          <span className="inline-flex items-center gap-2">
            <AlertCircle size={16} aria-hidden />
            {error}
          </span>
        </Callout>
      )}

      {draft && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-body font-semibold text-text">Gelesene Werte prüfen</h3>
            <button type="button" aria-label="Entwurf verwerfen" onClick={() => setDraft(null)} className="rounded-lg p-1 text-text-subtle hover:bg-surface-2">
              <X size={18} aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-small text-text-subtle">Testzeit laut Bericht: {when(draft.measuredAt)}</p>

          {failed.length > 0 ? (
            <Callout tone="warning" className="mt-3">
              <p className="font-medium">Diese Prüfungen sind nicht aufgegangen, vermutlich wurde eine Zahl falsch gelesen:</p>
              <ul className="mt-1 list-disc pl-5">
                {failed.map((c) => (
                  <li key={c.key}>{c.label}</li>
                ))}
              </ul>
              <p className="mt-1">Vergleiche die Werte unten mit dem Bericht und korrigiere sie.</p>
            </Callout>
          ) : (
            <p className="mt-2 inline-flex items-center gap-2 text-small text-text-2">
              <CheckCircle2 size={16} className="text-accent" aria-hidden />
              Alle Plausibilitätsprüfungen sind aufgegangen.
            </p>
          )}
          {uncertain.size > 0 && (
            <p className="mt-2 inline-flex items-start gap-2 text-xs text-text-subtle">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              Einzelne Ziffern kann die Texterkennung verlesen, ohne dass eine Prüfung es merkt. Mit „prüfen“ markierte Werte
              bitte kurz mit dem Bericht vergleichen.
            </p>
          )}

          {SECTIONS.map((section) => (
            <fieldset key={section.id} className="mt-4">
              <legend className="mb-2 text-small font-medium text-text-2">{section.title}</legend>
              <div className={`grid gap-2 ${section.columns}`}>
                {REPORT_FIELDS.filter((f) => f.section === section.id).map((field) => (
                  <Field key={field.id} label={`${field.label}${field.unit ? ` (${field.unit})` : ""}${field.uncertainAs && uncertain.has(field.uncertainAs) ? " – prüfen" : ""}`}>
                    {(props) => (
                      <Input
                        {...props}
                        inputMode="decimal"
                        value={texts[field.id] ?? ""}
                        onChange={(event) => setTexts((current) => ({ ...current, [field.id]: event.target.value }))}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" size="lg" fullWidth onClick={() => void onSave()} disabled={save.isPending}>
              {save.isPending ? "Speichert …" : "Als Messung speichern"}
            </Button>
            <Button variant="secondary" size="lg" fullWidth onClick={() => setDraft(null)}>
              Verwerfen
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
