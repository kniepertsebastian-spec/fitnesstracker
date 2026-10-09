import { useState } from "react";
import type { AiProvider } from "@fitnesstracker/shared";
import { useAiSettings, useDeleteAiSettings, useSaveAiSettings } from "../../hooks/useAiSettings";
import { Badge, Button, Callout, Card, Field, Input, Select, Skeleton } from "../ui";

export const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "GEMINI", label: "Google Gemini" },
  { value: "OPENAI", label: "OpenAI (ChatGPT)" },
  { value: "GROQ", label: "Groq" },
  { value: "OPENROUTER", label: "OpenRouter" },
];

// BYOK settings (provider + API key + optional model override). The key is stored encrypted on
// the server and only leaves it for calls to the chosen provider. Used by the AI plan generator.
export function AiKeyCard() {
  const { data: settings, isLoading } = useAiSettings();
  const saveSettings = useSaveAiSettings();
  const deleteSettings = useDeleteAiSettings();

  const [provider, setProvider] = useState<AiProvider>("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

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
      action={settings.hasApiKey ? <Badge tone="violet">Eigener Schlüssel</Badge> : undefined}
    >
      <p className="mb-3 text-small text-text-subtle">
        Eigener API-Key (BYOK) für die KI-Planung — der Key verlässt den Server nie außer für Aufrufe an den
        gewählten Anbieter.
      </p>
      <div className="flex flex-col gap-3">
        <Field label="Anbieter">
          {(p) => (
            <Select {...p} value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
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
        <Field label="Modell (optional)" hint="z. B. gpt-4o-mini">
          {(p) => <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} />}
        </Field>
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
