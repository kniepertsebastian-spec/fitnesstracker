import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { ColdStartInput, TrainingPhase } from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { useAiSettings } from "../../hooks/useAiSettings";
import {
  useAcceptPlanDraft,
  useDiscardPlanDraft,
  useGeneratePlan,
  usePlanDraftState,
  usePlanPreferences,
  useRestorePlanBackup,
} from "../../hooks/useAiPlanGenerator";
import { PROVIDER_OPTIONS } from "../settings/AiKeyCard";
import { Badge, Button, Callout, Card, Skeleton, Toggle } from "../ui";
import { ColdStartModal } from "./ColdStartModal";
import { PlanDraftPreview } from "./PlanDraftPreview";

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

// Generating never replaces the plan directly: it produces a draft shown for review, which is
// then accepted (the replaced plan stays restorable once) or discarded.
export function AiPlanGeneratorCard({ phase }: { phase: TrainingPhase }) {
  const { data: settings, isLoading } = useAiSettings();
  const { data: prefsData } = usePlanPreferences();
  const { data: draftState } = usePlanDraftState(phase);
  const generatePlan = useGeneratePlan();
  const acceptDraft = useAcceptPlanDraft(phase);
  const discardDraft = useDiscardPlanDraft(phase);
  const restoreBackup = useRestorePlanBackup(phase);

  const [coldStartOpen, setColdStartOpen] = useState(false);
  const [busyDay, setBusyDay] = useState<string | null>(null);
  const [allPhases, setAllPhases] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading || !settings) {
    return (
      <Card title="KI-Trainingsplan">
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (!settings.configured) {
    return (
      <Card title="KI-Trainingsplan">
        <p className="text-small text-text-subtle">Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert.</p>
      </Card>
    );
  }

  const preferences = prefsData?.preferences ?? null;
  const draft = draftState?.draft ?? null;
  const busy = generatePlan.isPending || acceptDraft.isPending || discardDraft.isPending || restoreBackup.isPending;

  const runGenerate = async (coldStart?: ColdStartInput, day?: string) => {
    setError(null);
    setNotice(null);
    setBusyDay(day ?? null);
    try {
      const result = await generatePlan.mutateAsync({ phase, coldStart, day, allPhases: allPhases || undefined });
      setColdStartOpen(result.status === "needs_cold_start");
      if (result.status === "draft") {
        const parts = [
          result.otherDrafts?.length
            ? "Entwürfe für alle drei Phasen erstellt — wechsle zwischen den Phasen, um sie zu prüfen und zu übernehmen."
            : null,
          result.replacedPlateaus?.length
            ? `Wegen Stagnation durch Varianten ersetzt: ${result.replacedPlateaus.join(", ")}.`
            : null,
        ].filter((part): part is string => part !== null);
        if (parts.length > 0) setNotice(parts.join(" "));
      }
    } catch (err) {
      setColdStartOpen(false);
      setError(errorText(err, "Plan konnte nicht generiert werden."));
    } finally {
      setBusyDay(null);
    }
  };

  const run = async (action: () => Promise<unknown>, success: string, fallback: string) => {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (err) {
      setError(errorText(err, fallback));
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={16} aria-hidden className="text-violet" /> KI-Trainingsplan
        </span>
      }
      action={settings.hasApiKey ? <Badge tone="violet">Eigener Schlüssel</Badge> : undefined}
    >
      <p className="text-small text-text-subtle">
        {settings.hasApiKey
          ? `Anbieter: ${PROVIDER_OPTIONS.find((o) => o.value === settings.provider)?.label ?? settings.provider}.`
          : "Für die KI-Planung brauchst du einen eigenen API-Key."}{" "}
        <Link to="/settings" className="text-accent hover:text-accent-hover">
          Schlüssel in den Einstellungen
        </Link>
      </p>

      {!draft && (
        <div className="mt-3 flex flex-col gap-2">
          <Toggle
            label="Alle drei Phasen in einem Durchgang (gleiche Übungen, nur Sätze/Wdh./Tempo wechseln)"
            checked={allPhases}
            onChange={setAllPhases}
          />
          <Button
            variant="primary"
            fullWidth
            disabled={!settings.hasApiKey || busy}
            onClick={() => setColdStartOpen(true)}
          >
            {generatePlan.isPending ? "Generiert…" : preferences ? "Antworten prüfen & generieren" : "Plan konfigurieren & generieren"}
          </Button>
          {preferences && (
            <Button
              variant="secondary"
              fullWidth
              disabled={!settings.hasApiKey || busy}
              onClick={() => runGenerate()}
            >
              Mit gespeicherten Antworten generieren
            </Button>
          )}
          {draftState?.hasBackup && (
            <Button
              variant="ghost"
              fullWidth
              disabled={busy}
              onClick={() => run(() => restoreBackup.mutateAsync(), "Vorheriger Plan wiederhergestellt.", "Wiederherstellen fehlgeschlagen.")}
            >
              Vorherigen Plan wiederherstellen
            </Button>
          )}
        </div>
      )}

      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
      {notice && (
        <Callout tone="info" className="mt-3">
          {notice}{" "}
          <Link to="/plan" className="text-accent hover:text-accent-hover">
            Zum Plan
          </Link>
        </Callout>
      )}

      {draft && (
        <PlanDraftPreview
          draft={draft}
          busyDay={busyDay}
          disabled={busy}
          onRegenerateDay={(day) => runGenerate(undefined, day)}
          onAccept={() => run(() => acceptDraft.mutateAsync(), "Plan übernommen.", "Übernehmen fehlgeschlagen.")}
          onDiscard={() => run(() => discardDraft.mutateAsync(), "Entwurf verworfen.", "Verwerfen fehlgeschlagen.")}
        />
      )}

      {coldStartOpen && (
        <ColdStartModal
          initial={preferences}
          isSubmitting={generatePlan.isPending}
          onCancel={() => setColdStartOpen(false)}
          onSubmit={(coldStart) => runGenerate(coldStart)}
        />
      )}
    </Card>
  );
}
