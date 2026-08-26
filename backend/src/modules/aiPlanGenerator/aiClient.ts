import type { AiProvider } from "@prisma/client";
import { HttpError } from "../../errors/httpErrors.js";

// All four providers expose (or fully proxy) an OpenAI-compatible chat-completions endpoint, so
// one call shape covers all of them — Gemini via Google's own OpenAI-compat surface, Groq and
// OpenRouter are OpenAI-compatible by design, OpenAI obviously is. Only the base URL, default
// model, and API key differ per provider.
interface ProviderConfig {
  baseUrl: string;
  defaultModel: string;
}

const PROVIDER_CONFIG: Record<AiProvider, ProviderConfig> = {
  OPENAI: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
  },
  GROQ: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
  },
  OPENROUTER: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "openai/gpt-4o-mini",
  },
  GEMINI: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.0-flash",
  },
};

export function defaultModelFor(provider: AiProvider): string {
  return PROVIDER_CONFIG[provider].defaultModel;
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// 502: the request we made was fine, the *upstream* provider (or its response shape) was the
// problem — reuses the app's existing HttpError hierarchy so routes handle it the same way as
// any other typed error, no bespoke catch needed.
export class AiProviderError extends HttpError {
  constructor(message: string) {
    super(502, message);
    this.name = "AiProviderError";
  }
}

// `baseUrlOverride` exists purely so the pipeline (prompt building -> this call -> Zod
// validation -> DB write) can be verified end-to-end against a local stub server without a real
// provider key — see the Phase 19 verification notes in ARCHITECTURE.md. Production callers
// never pass it.
export async function callChatCompletion(
  provider: AiProvider,
  apiKey: string,
  model: string | null,
  messages: ChatMessage[],
  options?: { baseUrlOverride?: string },
): Promise<string> {
  const config = PROVIDER_CONFIG[provider];
  const url = options?.baseUrlOverride ?? config.baseUrl;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model ?? config.defaultModel,
        messages,
        // json_object mode is supported broadly across all four providers/most of their models;
        // true json_schema-constrained output is not consistently supported yet, so this is the
        // safe common denominator. Zod validation of the parsed result (see
        // aiPlanGenerator.service.ts) is the real enforcement layer, not this flag.
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });
  } catch (error) {
    throw new AiProviderError(
      `Could not reach the AI provider: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiProviderError(`AI provider request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiProviderError("AI provider returned an empty response");
  }
  return content;
}
