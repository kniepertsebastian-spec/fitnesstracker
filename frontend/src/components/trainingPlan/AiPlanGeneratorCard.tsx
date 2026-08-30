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

// Curated shortlist per provider so users aren't left guessing exact model IDs. OpenRouter alone
// hosts hundreds of models under provider-prefixed IDs, so no static list can be complete for
// it (or stay accurate as providers ship new models) — every list ends with a "custom" option
// that reveals a free-text field instead, matching the server's own defaultModelFor fallback
// (aiClient.ts) when the field is left empty.
const CUSTOM_MODEL_VALUE = "__custom__";
const PROVIDER_MODELS: Record<AiProvider, { value: string; label: string }[]> = {
  OPENAI: [
    { value: "gpt-4o-mini", label: "GPT-4o mini (Standard, günstig)" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "o3-mini", label: "o3-mini (Reasoning)" },
  ],
  GROQ: [
    { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Standard)" },
    { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant" },
    { value: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
  OPENROUTER: [
    { value: "openai/gpt-4o-mini", label: "OpenAI: GPT-4o mini (Standard)" },
    { value: "anthropic/claude-3.5-sonnet", label: "Anthropic: Claude 3.5 Sonnet" },
    { value: "meta-llama/llama-3.3-70b-instruct", label: "Meta: Llama 3.3 70B Instruct" },
    { value: "google/gemini-2.0-flash-001", label: "Google: Gemini 2.0 Flash" },
  ],
  GEMINI: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Standard)" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
};

// BYOK settings (provider + API key + optional model override) plus the "Plan generieren"
// action for whichever phase is currently selected on /plan. A first generate attempt without
// enough workout history comes back asking for cold-start answers, which opens ColdStartModal
// and retries with them filled in — see aiPlanGenerator.service.ts's generatePlan.
export function AiPlanGeneratorCard({ phase }: { phase: TrainingPhase }) {
  const { data: settings, isLoading } = useAiSettings();
  const saveSettings = useSaveAiSettings();
  const deleteSettings = useDeleteAiSettings();
  const generatePlan = useGeneratePlan();

  const [provider, setProvider] = useState<AiProvider>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [coldStartOpen, setColdStartOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);

  if (isLoading || !settings) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
        <p className="text-sm text-ink-500">KI-Trainingsplan lädt…</p>
      </div>
    );
  }

  if (!settings.configured) {
    return (
      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
        <p className="text-sm font-medium text-ink-300">KI-Trainingsplan-Generator</p>
        <p className="mt-1 text-sm text-ink-600">
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
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <p className="text-sm font-medium text-ink-300">KI-Trainingsplan-Generator</p>
      <p className="mt-1 text-xs text-ink-500">
        Eigener API-Key (BYOK) — der Key verlässt den Server nie außer für Aufrufe an den
        gewählten Anbieter.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as AiProvider);
            setModel("");
            setIsCustomModel(false);
          }}
          className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
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
          className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
        />
        <select
          value={isCustomModel ? CUSTOM_MODEL_VALUE : model || PROVIDER_MODELS[provider][0].value}
          onChange={(e) => {
            if (e.target.value === CUSTOM_MODEL_VALUE) {
              setIsCustomModel(true);
              setModel("");
            } else {
              setIsCustomModel(false);
              setModel(e.target.value);
            }
          }}
          className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
        >
          {PROVIDER_MODELS[provider].map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value={CUSTOM_MODEL_VALUE}>Benutzerdefiniert…</option>
        </select>
        {isCustomModel && (
          <input
            type="text"
            placeholder="Modell-ID (z. B. mistralai/mistral-large)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saveSettings.isPending}
            className="flex-1 rounded-lg bg-ink-800 py-1.5 text-sm font-medium text-ink-200 hover:bg-ink-700 disabled:opacity-50"
          >
            {saveSettings.isPending ? "Speichert…" : "Key speichern"}
          </button>
          {settings.hasApiKey && (
            <button
              onClick={() => deleteSettings.mutate()}
              className="rounded-lg border border-ink-700 px-3 text-sm text-ink-500 hover:text-red-400"
            >
              Entfernen
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-xs text-ink-500">
        {settings.hasApiKey
          ? `Konfiguriert: ${PROVIDER_OPTIONS.find((o) => o.value === settings.provider)?.label ?? settings.provider}`
          : "Noch kein Anbieter konfiguriert."}
      </p>

      <button
        onClick={() => runGenerate()}
        disabled={!settings.hasApiKey || generatePlan.isPending}
        className="mt-3 w-full rounded-lg bg-violet-500 py-2 text-sm font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
      >
        {generatePlan.isPending ? "Generiert…" : "Plan für diese Phase generieren"}
      </button>

      {generateError && <p className="mt-2 text-sm text-red-400">{generateError}</p>}
      {generatedCount !== null && (
        <p className="mt-2 text-sm text-emerald-400">{generatedCount} Übungen generiert.</p>
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
