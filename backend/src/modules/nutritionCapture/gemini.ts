import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { ConflictError } from "../../errors/httpErrors.js";
import { decryptSecret } from "../../lib/crypto.js";
import { describeFetchError, fetchWithTimeout } from "../../lib/fetchWithTimeout.js";
import { AiProviderError } from "../aiPlanGenerator/aiClient.js";

// Multimodal JSON calls to Gemini for the Kalorientracker capture features (photo, voice, recipe
// import). Same native generateContent call as the technique check (formAnalysis.service.ts): the
// user's own key (BYOK, AiProviderSetting), inline media, JSON mode, strict schema afterwards.

// Stable, multimodal (image, audio, video) and cheap. gemini-2.5-flash is deprecated: new keys may
// not reach it, and from 2026-12-01 Google routes it to 3.5 Flash-Lite anyway. A model chosen in
// the Fitnesstracker's AI settings wins.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiMedia {
  mimeType: string;
  data: Buffer;
}

export interface GeminiRequest {
  prompt: string;
  media?: GeminiMedia[];
  timeoutMs?: number;
}

/** Sends one request and returns the parsed JSON answer (not yet validated). */
export type GeminiCaller = (request: GeminiRequest) => Promise<unknown>;

export interface GeminiCredentials {
  apiKey: string;
  model: string;
}

export async function geminiCredentials(prisma: PrismaClient, userId: string): Promise<GeminiCredentials> {
  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  if (!setting || setting.provider !== "GEMINI") {
    throw new ConflictError("Für Foto, Sprache und Rezept-Import muss im Fitnesstracker Gemini als KI-Anbieter hinterlegt sein");
  }
  if (!env.AI_SETTINGS_ENCRYPTION_KEY) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert");
  }
  const apiKey = decryptSecret(setting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY);
  const model = setting.model?.startsWith("gemini-") ? setting.model : DEFAULT_MODEL;
  return { apiKey, model };
}

export function geminiCaller(credentials: GeminiCredentials, baseUrl = GEMINI_BASE_URL): GeminiCaller {
  return async ({ prompt, media = [], timeoutMs = 60_000 }) => {
    let response: Response;
    try {
      response = await fetchWithTimeout(
        `${baseUrl}/models/${encodeURIComponent(credentials.model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": credentials.apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, ...media.map((m) => ({ inlineData: { mimeType: m.mimeType, data: m.data.toString("base64") } }))] }],
            // Low temperature: reading a label is transcription, not creativity.
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
          }),
        },
        timeoutMs,
      );
    } catch (error) {
      throw new AiProviderError(`Gemini konnte nicht erreicht werden: ${describeFetchError(error, timeoutMs)}`);
    }
    if (!response.ok) {
      // The body may echo the request; only the status goes into the message.
      throw new AiProviderError(`Gemini-Anfrage fehlgeschlagen (${response.status})`);
    }
    const payload = (await response.json().catch(() => null)) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null;
    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
    if (!text) throw new AiProviderError("Gemini hat keine Antwort geliefert");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AiProviderError("Gemini hat kein gültiges JSON geliefert");
    }
  };
}

/** Validates an AI answer; anything that does not fit the schema is a provider error, not a guess. */
export function parseAiAnswer<T extends z.ZodTypeAny>(schema: T, answer: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(answer);
  if (!result.success) throw new AiProviderError(`Die KI-Antwort (${what}) hatte nicht das erwartete Format`);
  return result.data;
}
