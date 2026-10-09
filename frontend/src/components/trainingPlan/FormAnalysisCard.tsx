import { useState } from "react";
import { ApiError } from "../../api/client";
import { useFormAnalysis } from "../../hooks/useFormAnalysis";

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
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-medium text-text-muted">KI-Technik-Check mit Gemini</p>
      <p className="mt-1 text-xs text-text-faint">
        Kurzen Clip aus einer gut sichtbaren Perspektive hochladen. Das Video wird nicht in der
        App gespeichert, aber zur Analyse an Google Gemini übertragen.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          value={exerciseName}
          onChange={(event) => setExerciseName(event.target.value)}
          maxLength={120}
          placeholder="Übung, z. B. Kniebeuge"
          className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm"
        />
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(event) => setVideo(event.target.files?.[0] ?? null)}
          className="w-full text-sm text-text-subtle file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text-2"
        />
        <button
          onClick={submit}
          disabled={analysis.isPending}
          className="rounded-lg bg-accent py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {analysis.isPending ? "Gemini analysiert…" : "Ausführung analysieren"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger-text">{error}</p>}

      {analysis.data && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-text">{analysis.data.exerciseName}</p>
            <span className="rounded-full bg-accent/15 px-2 py-1 text-sm font-semibold text-accent-hover">
              {analysis.data.rating}/10
            </span>
          </div>
          <p className="mt-2 text-sm text-text-muted">{analysis.data.summary}</p>

          {analysis.data.strengths.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-accent">Das läuft gut</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-text-muted">
                {analysis.data.strengths.map((strength) => <li key={strength}>{strength}</li>)}
              </ul>
            </div>
          )}
          {analysis.data.improvements.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-warning">Verbesserungen</p>
              {analysis.data.improvements.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-lg border border-border bg-bg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <span className="text-xs text-text-faint">
                      {item.timestamp ? `${item.timestamp} · ` : ""}{PRIORITY_LABELS[item.priority]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-subtle">{item.detail}</p>
                </div>
              ))}
            </div>
          )}
          {analysis.data.safetyNotes.length > 0 && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
              <p className="text-xs font-medium text-danger-text">Sicherheit</p>
              {analysis.data.safetyNotes.map((note) => <p key={note} className="mt-1 text-sm text-danger-text">{note}</p>)}
            </div>
          )}
          <p className="mt-3 text-xs text-text-faint">
            KI-Einschätzung, keine medizinische Diagnose. Bei Schmerzen Training stoppen und fachlichen Rat einholen.
          </p>
        </div>
      )}
    </div>
  );
}
