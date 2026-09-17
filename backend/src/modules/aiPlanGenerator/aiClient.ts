import type { AiProvider } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { HttpError } from "../../errors/httpErrors.js";

// OPENAI/GROQ/OPENROUTER/GEMINI expose (or fully proxy) an OpenAI-compatible chat-completions
// endpoint, so one fetch-based call shape covers all four — Gemini via Google's own
// OpenAI-compat surface, Groq and OpenRouter are OpenAI-compatible by design, OpenAI obviously
// is. Only the base URL, default model, and API key differ per provider. ANTHROPIC has its own
// Messages API shape (separate `system` field, no `response_format: json_object` mode) and is
// handled separately below via the official SDK — see callAnthropic.
interface ProviderConfig {
  baseUrl: string;
  defaultModel: string;
}

type OpenAiCompatibleProvider = "OPENAI" | "GROQ" | "OPENROUTER" | "GEMINI";

const PROVIDER_CONFIG: Record<OpenAiCompatibleProvider, ProviderConfig> = {
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

// Haiku 4.5 rather than a Sonnet/Opus-tier model: this call is constrained JSON generation
// against an already-narrowed exercise catalog (see promptBuilder.ts), not open-ended reasoning
// — the cheapest current Claude model handles it fine, and it keeps the default cost in line
// with the other providers' picks above (gpt-4o-mini, gemini-2.0-flash, ...). Users who want a
// stronger model can still override via the optional `model` field.
const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5";

export function defaultModelFor(provider: AiProvider): string {
  return provider === "ANTHROPIC" ? ANTHROPIC_DEFAULT_MODEL : PROVIDER_CONFIG[provider].defaultModel;
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
  if (provider === "ANTHROPIC") {
    return callAnthropic(apiKey, model, messages, options);
  }

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

// Claude's Messages API takes `system` as its own top-level field rather than a message with
// role "system", and has no `response_format: json_object` mode — the prompt itself already
// instructs "respond with nothing but valid JSON" (see promptBuilder.ts's buildSystemPrompt),
// which Claude follows reliably without it. Extended thinking is intentionally left off: this is
// single-shot constrained generation against a fixed catalog, not the kind of open-ended
// reasoning task that benefits from it, and turning it on would add latency/cost with no
// expected quality gain here.
async function callAnthropic(
  apiKey: string,
  model: string | null,
  messages: ChatMessage[],
  options?: { baseUrlOverride?: string },
): Promise<string> {
  const systemPrompt = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => ({ role: "user" as const, content: message.content }));

  const client = new Anthropic({
    apiKey,
    ...(options?.baseUrlOverride ? { baseURL: options.baseUrlOverride } : {}),
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: model ?? ANTHROPIC_DEFAULT_MODEL,
      max_tokens: 16000,
      system: systemPrompt,
      messages: userMessages,
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new AiProviderError(`AI provider request failed (${error.status}): ${error.message.slice(0, 300)}`);
    }
    throw new AiProviderError(
      `Could not reach the AI provider: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (!textBlock?.text) {
    throw new AiProviderError("AI provider returned an empty response");
  }
  return textBlock.text;
}
