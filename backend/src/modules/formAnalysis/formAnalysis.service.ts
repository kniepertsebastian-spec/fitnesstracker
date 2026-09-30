import type { PrismaClient } from "@prisma/client";
import { formAnalysisResultSchema, type FormAnalysisResult } from "@fitnesstracker/shared";
import { env } from "../../config/env.js";
import { ConflictError } from "../../errors/httpErrors.js";
import { decryptSecret } from "../../lib/crypto.js";
import { AiProviderError } from "../aiPlanGenerator/aiClient.js";

const DEFAULT_VIDEO_MODEL = "gemini-2.5-flash";

export async function analyzeExerciseForm(
  prisma: PrismaClient,
  userId: string,
  exerciseName: string,
  mimeType: string,
  video: Buffer,
): Promise<FormAnalysisResult> {
  const setting = await prisma.aiProviderSetting.findUnique({ where: { userId } });
  if (!setting || setting.provider !== "GEMINI") {
    throw new ConflictError("Für den Technik-Check muss Gemini als KI-Anbieter konfiguriert sein");
  }
  if (!env.AI_SETTINGS_ENCRYPTION_KEY) {
    throw new ConflictError("Der Server hat noch keinen AI_SETTINGS_ENCRYPTION_KEY konfiguriert");
  }
  const apiKey = decryptSecret(setting.encryptedApiKey, env.AI_SETTINGS_ENCRYPTION_KEY);
  const model = setting.model?.startsWith("gemini-") ? setting.model : DEFAULT_VIDEO_MODEL;
  const exerciseLabel = JSON.stringify(exerciseName);
  const prompt = `Analysiere die Ausführung der vom Nutzer bezeichneten Übung ${exerciseLabel} im Video als vorsichtiger, erfahrener Fitnesstrainer.
Bewerte nur sichtbar erkennbare Aspekte. Erfinde keine Gelenkwinkel, Schmerzen oder Diagnosen. Wenn Perspektive,
Bildqualität oder Ausschnitt eine Bewertung verhindern, sage das konkret. Nenne Zeitpunkte im Format mm:ss,
wenn möglich. Priorisiere sichere, direkt umsetzbare Korrekturen. Gib ausschließlich JSON zurück:
{"exerciseName":${exerciseLabel},"rating":1-10,"summary":"...","strengths":["..."],
"improvements":[{"title":"...","detail":"...","priority":"high|medium|low","timestamp":"mm:ss oder null"}],
"safetyNotes":["..."]}`;

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inlineData: { mimeType, data: video.toString("base64") } },
          ] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
      },
    );
  } catch (error) {
    throw new AiProviderError(`Gemini konnte nicht erreicht werden: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiProviderError(`Gemini-Videoanalyse fehlgeschlagen (${response.status}): ${body.slice(0, 300)}`);
  }
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!text) throw new AiProviderError("Gemini hat keine Videoanalyse zurückgegeben");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiProviderError("Gemini hat kein gültiges Analyseformat zurückgegeben");
  }
  const result = formAnalysisResultSchema.safeParse(parsed);
  if (!result.success) throw new AiProviderError("Geminis Analyse war unvollständig");
  return { ...result.data, exerciseName };
}
