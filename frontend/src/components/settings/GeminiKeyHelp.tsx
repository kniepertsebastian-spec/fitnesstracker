import { ExternalLink } from "lucide-react";
import { Callout } from "../ui";

export const AI_STUDIO_KEY_URL = "https://aistudio.google.com/apikey";
export const GEMINI_LIMITS_URL = "https://ai.google.dev/gemini-api/docs/rate-limits";

// Models worth entering for the free tier. Google changes the lineup and the quotas now and then, so
// the card names no numbers and points at the current limits instead.
export const GEMINI_MODEL_SUGGESTIONS: { id: string; note: string }[] = [
  { id: "gemini-3.5-flash-lite", note: "Standard dieser App — schnell, günstig, kann Fotos, Audio und Video" },
  { id: "gemini-3.8-flash", note: "gründlicher, wenn Trainingspläne oder Analysen zu knapp ausfallen" },
];

// Model ids offered for each provider in the model field of the key card.
export const MODEL_SUGGESTIONS: Record<"GEMINI" | "OPENAI" | "GROQ" | "OPENROUTER", string[]> = {
  GEMINI: GEMINI_MODEL_SUGGESTIONS.map((m) => m.id),
  OPENAI: ["gpt-4o-mini"],
  GROQ: ["llama-3.3-70b-versatile"],
  OPENROUTER: ["openai/gpt-4o-mini"],
};

function ExternalA({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent-text underline-offset-2 hover:text-accent-text-hover hover:underline"
    >
      {children}
      <ExternalLink size={13} aria-hidden />
    </a>
  );
}

// Shown while no API key is stored: the AI features need one, and Google Gemini has a free quota, so
// nobody has to pay to try them.
export function GeminiKeyHelp({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Callout tone="info" className="mt-3">
        <p>
          <strong className="text-text">Kein KI-Schlüssel hinterlegt.</strong> Google Gemini bietet ein kostenloses
          Kontingent — den Key bekommst du in <ExternalA href={AI_STUDIO_KEY_URL}>Google AI Studio</ExternalA>, die
          Anleitung steht in den Einstellungen.
        </p>
      </Callout>
    );
  }

  return (
    <Callout tone="info" className="mb-4">
      <p className="font-medium text-text">Kostenlos starten mit Google Gemini</p>
      <p className="mt-1">
        Für die KI-Funktionen (Trainingsplan, Dehnplan, Supplement-Check, Analysen) brauchst du einen eigenen
        API-Key. Google Gemini hat ein kostenloses Kontingent — für den persönlichen Gebrauch reicht es meist, ohne
        Kreditkarte.
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          <ExternalA href={AI_STUDIO_KEY_URL}>aistudio.google.com/apikey</ExternalA> öffnen und mit einem Google-Konto
          anmelden.
        </li>
        <li>„API-Schlüssel erstellen“ (Create API key) wählen. Ein Projekt wird bei Bedarf automatisch angelegt.</li>
        <li>Den Schlüssel kopieren, unten bei Anbieter „Google Gemini“ wählen, einfügen und speichern.</li>
      </ol>
      <p className="mt-2 font-medium text-text">Modelle für das kostenlose Kontingent</p>
      <ul className="mt-1 space-y-0.5">
        {GEMINI_MODEL_SUGGESTIONS.map((m) => (
          <li key={m.id}>
            <code className="rounded bg-surface-inset px-1 py-0.5 text-xs text-text">{m.id}</code> — {m.note}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-text-subtle">
        Das Feld „Modell“ darf leer bleiben, dann nimmt die App den Standard. Kostenlose Kontingente sind pro Minute
        und Tag begrenzt, Google ändert Modelle und Limits gelegentlich — aktuelle Werte:{" "}
        <ExternalA href={GEMINI_LIMITS_URL}>Rate Limits</ExternalA>. Im kostenlosen Kontingent darf Google die
        gesendeten Eingaben zur Produktverbesserung nutzen; sende dort also nichts, was du nicht teilen willst.
      </p>
    </Callout>
  );
}
