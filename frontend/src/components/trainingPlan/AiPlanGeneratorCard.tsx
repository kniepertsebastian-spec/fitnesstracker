import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { ColdStartInput, TrainingPhase } from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { useAiSettings } from "../../hooks/useAiSettings";
import { useGeneratePlan } from "../../hooks/useAiPlanGenerator";
import { PROVIDER_OPTIONS } from "../settings/AiKeyCard";
import { Badge, Button, Callout, Card, Skeleton } from "../ui";
import { ColdStartModal } from "./ColdStartModal";

// "Plan generieren" for the selected phase. The provider/API key itself is managed in the
// Settings ("KI-Schlüssel"). The questionnaire opens for every generation so current
// goals/preferences can be combined with any existing workout history.
export function AiPlanGeneratorCard({ phase }: { phase: TrainingPhase }) {
  const { data: settings, isLoading } = useAiSettings();
  const generatePlan = useGeneratePlan();

  const [coldStartOpen, setColdStartOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);

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

  const runGenerate = async (coldStart?: ColdStartInput) => {
    setGenerateError(null);
    setGeneratedCount(null);
    try {
      const result = await generatePlan.mutateAsync({ phase, coldStart });
      if (result.status === "needs_cold_start") {
        setColdStartOpen(true);
      } else {
        setColdStartOpen(false);
        setGeneratedCount(result.items.length);
      }
    } catch (err) {
      setColdStartOpen(false);
      setGenerateError(err instanceof ApiError ? err.message : "Plan konnte nicht generiert werden.");
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

      <Button
        variant="primary"
        fullWidth
        className="mt-3"
        disabled={!settings.hasApiKey || generatePlan.isPending}
        onClick={() => setColdStartOpen(true)}
      >
        {generatePlan.isPending ? "Generiert…" : "Plan konfigurieren & generieren"}
      </Button>

      {generateError && (
        <Callout tone="danger" className="mt-3">
          {generateError}
        </Callout>
      )}
      {generatedCount !== null && (
        <Callout tone="info" className="mt-3">
          {generatedCount} Übungen generiert.
        </Callout>
      )}

      {coldStartOpen && (
        <ColdStartModal
          isSubmitting={generatePlan.isPending}
          onCancel={() => setColdStartOpen(false)}
          onSubmit={(coldStart) => runGenerate(coldStart)}
        />
      )}
    </Card>
  );
}
