import { useState } from "react";
import type { AiProvider, ColdStartInput, TrainingPhase } from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { useAiSettings, useDeleteAiSettings, useSaveAiSettings } from "../../hooks/useAiSettings";
import { useGeneratePlan } from "../../hooks/useAiPlanGenerator";
import { ColdStartModal } from "./ColdStartModal";

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "GEMINI", label: "Google Gemini" },
  { value: "OPENAI", label: "OpenAI (ChatGPT)" },
  { value: "GROQ", label: "Groq" },
  { value: "OPENROUTER", label: "OpenRouter" },
];

// BYOK settings (provider + API key + optional model override) plus the "Plan generieren"
// action for whichever phase is currently selected on /plan. The questionnaire opens for every
// generation so current goals/preferences can be combined with any existing workout history.
export function AiPlanGeneratorCard({ phase }: { phase: TrainingPhase }) {
  const { data: settings, isLoading } = useAiSettings();
  const saveSettings = useSaveAiSettings();
  const deleteSettings = useDeleteAiSettings();
  const generatePlan = useGeneratePlan();

  const [provider, setProvider] = useState<AiProvider>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [coldStartOpen, setColdStartOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);

  if (isLoading || !settings) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-text-faint">KI-Trainingsplan lädt…</p>
      </div>
    );
  }

  if (!settings.configured) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm font-medium text-text-muted">KI-Trainingsplan-Generator</p>
        <p className="mt-1 text-sm text-text-faint">
          Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert.
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await saveSettings.mutateAsync({ provider, apiKey: apiKey.trim(), model: model.trim() || undefined });
    setApiKey("");
  };

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
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-medium text-text-muted">KI-Trainingsplan-Generator</p>
      <p className="mt-1 text-xs text-text-faint">
        Eigener API-Key (BYOK) — der Key verlässt den Server nie außer für Aufrufe an den
        gewählten Anbieter.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as AiProvider)}
          className="w-full rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-sm"
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="password"
          placeholder={settings.hasApiKey ? "Neuen API-Key eingeben zum Ändern" : "API-Key"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Modell (optional, z. B. gpt-4o-mini)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saveSettings.isPending}
            className="flex-1 rounded-lg bg-surface-2 py-1.5 text-sm font-medium text-text-2 hover:bg-control disabled:opacity-50"
          >
            {saveSettings.isPending ? "Speichert…" : "Key speichern"}
          </button>
          {settings.hasApiKey && (
            <button
              onClick={() => deleteSettings.mutate()}
              className="rounded-lg border border-border-strong px-3 text-sm text-text-faint hover:text-danger-text"
            >
              Entfernen
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-text-faint">
        {settings.hasApiKey
          ? `Konfiguriert: ${PROVIDER_OPTIONS.find((o) => o.value === settings.provider)?.label ?? settings.provider}`
          : "Noch kein Anbieter konfiguriert."}
      </p>

      <button
        onClick={() => setColdStartOpen(true)}
        disabled={!settings.hasApiKey || generatePlan.isPending}
        className="mt-3 w-full rounded-lg bg-accent py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
      >
        {generatePlan.isPending ? "Generiert…" : "Plan konfigurieren & generieren"}
      </button>

      {generateError && <p className="mt-2 text-sm text-danger-text">{generateError}</p>}
      {generatedCount !== null && (
        <p className="mt-2 text-sm text-accent">{generatedCount} Übungen generiert.</p>
      )}

      {coldStartOpen && (
        <ColdStartModal
          isSubmitting={generatePlan.isPending}
          onCancel={() => setColdStartOpen(false)}
          onSubmit={(coldStart) => runGenerate(coldStart)}
        />
      )}
    </div>
  );
}
