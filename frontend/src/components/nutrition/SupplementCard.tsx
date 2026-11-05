import { useState } from "react";
import type { SupplementAnalysisDto, SupplementVerdict } from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import {
  useAnalyzeSupplement,
  useCreateSupplement,
  useDeleteSupplement,
  useSupplements,
  useUpdateSupplement,
} from "../../hooks/useSupplements";
import { Check, Info, Pill, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge, type BadgeTone, Button, Callout, Card, EmptyState, IconButton, Input, ListRow, Skeleton } from "../ui";
import { triggerHaptic } from "../../lib/haptic";

const VERDICT_META: Record<
  SupplementVerdict,
  { label: string; tone: BadgeTone }
> = {
  ESSENTIAL: { label: "Sehr sinnvoll (Basis)", tone: "accent" },
  USEFUL: { label: "Sinnvoll für dein Ziel", tone: "magenta" },
  SITUATIONAL: { label: "Situativ / Optional", tone: "warning" },
  NOT_RECOMMENDED: { label: "Kaum Mehrwert / Nicht empfohlen", tone: "danger" },
};

export function SupplementCard() {
  const { data: supplements, isLoading } = useSupplements();
  const createSupplement = useCreateSupplement();
  const updateSupplement = useUpdateSupplement();
  const deleteSupplement = useDeleteSupplement();
  const analyzeSupplement = useAnalyzeSupplement();

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("08:00");
  const [error, setError] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<SupplementAnalysisDto | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = async (analysisOverride?: SupplementAnalysisDto | null) => {
    const targetName = (analysisOverride?.displayNameDe ?? name).trim();
    const targetTime = analysisOverride?.suggestedReminderTime ?? time;
    if (!targetName) return;

    setError(null);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await createSupplement.mutateAsync({
        name: targetName,
        reminderTime: targetTime,
        timeZone,
        aiAnalysis: analysisOverride ?? activeAnalysis ?? null,
      });
      triggerHaptic("success");
      setName("");
      setNotes("");
      setActiveAnalysis(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht gespeichert werden.");
    }
  };

  const handleAnalyze = async () => {
    if (!name.trim() || analyzeSupplement.isPending) return;
    setError(null);
    try {
      const result = await analyzeSupplement.mutateAsync({
        name: name.trim(),
        notesOrIngredients: notes.trim() || undefined,
      });
      triggerHaptic("tap");
      setActiveAnalysis(result);
      setTime(result.suggestedReminderTime);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "KI-Analyse fehlgeschlagen. Prüfe deinen API-Key in den KI-Einstellungen.",
      );
    }
  };

  return (
    <Card title="Supplements & KI-Evidenz-Advisor" className="lg:max-w-xl">
      <p className="mb-3 text-small text-text-subtle">
        Prüfe Supplements evidenzbasiert auf dein Profil, deine aktuelle Trainingsphase und deinen bestehenden
        Stack — oder lege direkt eine tägliche Push-Erinnerung an.
      </p>

      {isLoading ? (
        <Skeleton className="mb-3 h-16 w-full" />
      ) : supplements && supplements.length > 0 ? (
        <div className="mb-4">
          {supplements.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id} className="border-b border-border last:border-b-0">
                <ListRow>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={s.enabled ? "text-body text-text-2" : "text-body text-text-faint line-through"}>
                          {s.name}
                        </p>
                        {s.aiAnalysis && (
                          <Badge tone={VERDICT_META[s.aiAnalysis.verdict].tone}>
                            Tier {s.aiAnalysis.evidenceTier} · {s.aiAnalysis.goalFitScore}/10
                          </Badge>
                        )}
                      </div>
                      <p className="tabular font-numeric text-xs text-text-faint">
                        {s.reminderTime} Uhr
                        {s.aiAnalysis ? ` · ${s.aiAnalysis.recommendedDosage}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {s.aiAnalysis && (
                        <IconButton
                          aria-label={`KI-Bewertung für ${s.name} anzeigen`}
                          className="border-transparent bg-transparent"
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        >
                          <Info size={16} aria-hidden />
                        </IconButton>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateSupplement.mutate({ id: s.id, input: { enabled: !s.enabled } })}
                      >
                        {s.enabled ? "Pausieren" : "Aktivieren"}
                      </Button>
                      <IconButton
                        aria-label={`${s.name} löschen`}
                        className="border-transparent bg-transparent hover:text-danger-text"
                        onClick={() => deleteSupplement.mutate(s.id)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </IconButton>
                    </div>
                  </div>
                </ListRow>
                {isExpanded && s.aiAnalysis && (
                  <div className="mb-3 rounded-lg border border-border bg-bg p-3 text-small">
                    <AnalysisDetails analysis={s.aiAnalysis} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={<Pill size={18} aria-hidden />} text="Noch keine Supplements hinterlegt." className="py-4" />
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            aria-label="Name des Supplements"
            placeholder="Supplement (z. B. Kreatin, Ashwagandha, Booster)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Input
            aria-label="Uhrzeit der Erinnerung"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-28"
          />
          <IconButton aria-label="Supplement direkt hinzufügen" onClick={() => void handleAdd(null)}>
            <Plus size={18} aria-hidden />
          </IconButton>
        </div>

        <div className="flex gap-2">
          <Input
            aria-label="Optionale Inhaltsstoffe oder Dosis vom Etikett"
            placeholder="Optional: Inhaltsstoffe / Etikett-Notiz für genaueren KI-Check"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-w-0 flex-1 text-small"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!name.trim() || analyzeSupplement.isPending}
            iconLeft={<Sparkles size={16} aria-hidden />}
            onClick={() => void handleAnalyze()}
          >
            {analyzeSupplement.isPending ? "Prüfe…" : "KI-Check"}
          </Button>
        </div>
      </div>

      {activeAnalysis && (
        <div className="mt-4 rounded-xl border border-accent-border bg-bg p-4">
          <AnalysisDetails analysis={activeAnalysis} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Check size={16} aria-hidden />}
              onClick={() => void handleAdd(activeAnalysis)}
            >
              Als Wecker übernehmen ({activeAnalysis.suggestedReminderTime} Uhr)
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveAnalysis(null)}>
              Schließen
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
    </Card>
  );
}

function AnalysisDetails({ analysis }: { analysis: SupplementAnalysisDto }) {
  const verdict = VERDICT_META[analysis.verdict];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-text">{analysis.displayNameDe}</span>
          <Badge tone={verdict.tone}>{verdict.label}</Badge>
          <Badge tone="neutral">Evidenz-Tier {analysis.evidenceTier}</Badge>
        </div>
        <span className="tabular font-numeric text-xs text-text-subtle">
          Ziel-Fit: <strong className="text-text">{analysis.goalFitScore}/10</strong>
        </span>
      </div>

      <p className="text-small text-text-2">{analysis.personalizedRecommendation}</p>
      <p className="text-xs text-text-subtle">{analysis.generalEvidenceSummary}</p>

      <div className="mt-1 grid grid-cols-1 gap-2 rounded-lg border border-border p-2.5 text-xs sm:grid-cols-2">
        <div>
          <span className="block text-text-faint">Empfohlene Dosis (für dein Profil)</span>
          <span className="font-medium text-text">{analysis.recommendedDosage}</span>
        </div>
        <div>
          <span className="block text-text-faint">Optimales Timing</span>
          <span className="font-medium text-text">
            {analysis.optimalTiming} (Vorschlag: {analysis.suggestedReminderTime} Uhr)
          </span>
        </div>
      </div>

      {analysis.stackWarnings.length > 0 && (
        <Callout tone="warning">
          <p className="font-medium text-text">Wechselwirkung mit deinem Stack:</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-text-subtle">
            {analysis.stackWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </Callout>
      )}

      {analysis.sideEffectsOrCautions.length > 0 && (
        <p className="text-xs text-text-faint">
          <strong>Hinweise:</strong> {analysis.sideEffectsOrCautions.join(" · ")}
        </p>
      )}
    </div>
  );
}
