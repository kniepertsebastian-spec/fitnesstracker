import { useState } from "react";
import { ApiError } from "../../api/client";
import { useFormAnalysis } from "../../hooks/useFormAnalysis";
import { Badge, Button, Callout, Card, Field, Input } from "../ui";

const PRIORITY_LABELS = { high: "Hoch", medium: "Mittel", low: "Niedrig" } as const;

export function FormAnalysisCard() {
  const analysis = useFormAnalysis();
  const [exerciseName, setExerciseName] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = () => {
    setValidationError(null);
    if (!exerciseName.trim() || !video) {
      setValidationError("Bitte Übung und Video angeben.");
      return;
    }
    if (video.size > 10 * 1024 * 1024) {
      setValidationError("Das Video darf maximal 10 MB groß sein.");
      return;
    }
    analysis.mutate({ exerciseName: exerciseName.trim(), video });
  };

  const error = validationError ?? (analysis.error
    ? analysis.error instanceof ApiError ? analysis.error.message : "Video konnte nicht analysiert werden."
    : null);

  return (
    <Card title="KI-Technik-Check mit Gemini">
      <p className="text-small text-text-subtle">
        Kurzen Clip aus einer gut sichtbaren Perspektive hochladen. Das Video wird nicht in der
        App gespeichert, aber zur Analyse an Google Gemini übertragen.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Übung">
          {(p) => (
            <Input
              {...p}
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
              maxLength={120}
              placeholder="z. B. Kniebeuge"
            />
          )}
        </Field>
        <Field label="Video" hint="MP4, WebM oder MOV, max. 10 MB">
          {(p) => (
            <input
              {...p}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(event) => setVideo(event.target.files?.[0] ?? null)}
              className="text-small text-text-subtle file:mr-3 file:min-h-9 file:rounded-md file:border file:border-border-strong file:bg-control file:px-3 file:text-text-2"
            />
          )}
        </Field>
        <Button variant="primary" disabled={analysis.isPending} onClick={submit}>
          {analysis.isPending ? "Gemini analysiert…" : "Ausführung analysieren"}
        </Button>
      </div>
      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}

      {analysis.data && (
        <div className="mt-4 border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body font-medium text-text">{analysis.data.exerciseName}</p>
            <Badge tone="accent">{analysis.data.rating}/10</Badge>
          </div>
          <p className="mt-2 text-small text-text-muted">{analysis.data.summary}</p>

          {analysis.data.strengths.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-accent">Das läuft gut</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-small text-text-muted">
                {analysis.data.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.data.improvements.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-warning">Verbesserungen</p>
              {analysis.data.improvements.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-lg bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-small font-medium text-text">{item.title}</p>
                    <span className="text-xs text-text-faint">
                      {item.timestamp ? `${item.timestamp} · ` : ""}
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                  </div>
                  <p className="mt-1 text-small text-text-subtle">{item.detail}</p>
                </div>
              ))}
            </div>
          )}
          {analysis.data.safetyNotes.length > 0 && (
            <Callout tone="danger" className="mt-3">
              <p className="font-medium text-text">Sicherheit</p>
              {analysis.data.safetyNotes.map((note) => (
                <p key={note} className="mt-1">
                  {note}
                </p>
              ))}
            </Callout>
          )}
          <p className="mt-3 text-xs text-text-faint">
            KI-Einschätzung, keine medizinische Diagnose. Bei Schmerzen Training stoppen und fachlichen Rat einholen.
          </p>
        </div>
      )}
    </Card>
  );
}
