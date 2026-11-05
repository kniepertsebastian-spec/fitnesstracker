import { useState } from "react";
import type { AiProvider } from "@fitnesstracker/shared";
import { useAiSettings, useDeleteAiSettings, useSaveAiSettings } from "../../hooks/useAiSettings";
import { Badge, Button, Callout, Card, Field, Input, Select, Skeleton } from "../ui";

export const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "ANTHROPIC", label: "Anthropic (Claude)" },
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
  ANTHROPIC: [
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 (Standard, günstig & schnell)" },
    { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { value: "claude-opus-5", label: "Claude Opus 5 (stärkste Qualität)" },
  ],
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

// BYOK settings (provider + API key + optional model override). The key is stored encrypted on
// the server and only leaves it for calls to the chosen provider. Used by the AI plan generator.
export function AiKeyCard() {
  const { data: settings, isLoading } = useAiSettings();
  const saveSettings = useSaveAiSettings();
  const deleteSettings = useDeleteAiSettings();

  const [provider, setProvider] = useState<AiProvider>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isCustomModel, setIsCustomModel] = useState(false);

  if (isLoading || !settings) {
    return (
      <Card title="KI-Schlüssel">
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  if (!settings.configured) {
    return (
      <Card title="KI-Schlüssel">
        <p className="text-small text-text-subtle">Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert.</p>
      </Card>
    );
  }

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    await saveSettings.mutateAsync({ provider, apiKey: apiKey.trim(), model: model.trim() || undefined });
    setApiKey("");
  };

  return (
    <Card
      title="KI-Schlüssel"
      action={settings.hasApiKey ? <Badge tone="magenta">Eigener Schlüssel</Badge> : undefined}
    >
      <p className="mb-3 text-small text-text-subtle">
        Eigener API-Key (BYOK) für die KI-Planung — der Key verlässt den Server nie außer für Aufrufe an den
        gewählten Anbieter.
      </p>
      <div className="flex flex-col gap-3">
        <Field label="Anbieter">
          {(p) => (
            <Select {...p} value={provider} onChange={(e) => {
                setProvider(e.target.value as AiProvider);
                setModel("");
                setIsCustomModel(false);
              }}>
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="API-Key">
          {(p) => (
            <Input
              {...p}
              type="password"
              autoComplete="off"
              placeholder={settings.hasApiKey ? "Neuen API-Key eingeben zum Ändern" : "API-Key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          )}
        </Field>
        <Field label="Modell">
          {(p) => (
            <Select
              {...p}
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
            >
              {PROVIDER_MODELS[provider].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value={CUSTOM_MODEL_VALUE}>Anderes Modell…</option>
            </Select>
          )}
        </Field>
        {isCustomModel && (
          <Field label="Modell-ID">
            {(p) => (
              <Input
                {...p}
                placeholder="z. B. mistralai/mistral-large"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            )}
          </Field>
        )}
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            disabled={!apiKey.trim() || saveSettings.isPending}
            onClick={handleSave}
          >
            {saveSettings.isPending ? "Speichert…" : "Key speichern"}
          </Button>
          {settings.hasApiKey && (
            <Button variant="ghost" onClick={() => deleteSettings.mutate()}>
              Entfernen
            </Button>
          )}
        </div>
        <p className="text-xs text-text-faint">
          {settings.hasApiKey
            ? `Konfiguriert: ${PROVIDER_OPTIONS.find((o) => o.value === settings.provider)?.label ?? settings.provider}`
            : "Noch kein Anbieter konfiguriert."}
        </p>
        {saveSettings.isError && <Callout tone="danger">Key konnte nicht gespeichert werden.</Callout>}
      </div>
    </Card>
  );
}
