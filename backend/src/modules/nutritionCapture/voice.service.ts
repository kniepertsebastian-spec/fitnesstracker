import { voiceAiSchema, type CaptureStatus, type VoiceAi } from "@fitnesstracker/shared";
import { parseAiAnswer, type GeminiCaller, type GeminiMedia } from "./gemini.js";
import type { FoodCandidate, FoodMatcher } from "./foodMatch.js";
import { normalizeUnit } from "./ingredientParser.js";

// Voice input: a recorded clip (more reliable on iOS than the Web Speech API) or typed text goes
// to Gemini, which only splits it into foods with the amount and unit that were said. Matching
// against the food layers happens here, nutrients come from the matched food, and the app shows
// everything as a preview to confirm. Nothing is logged without that confirmation.

export const VOICE_PROMPT = `Extrahiere aus der gesprochenen Mahlzeitbeschreibung (deutsch) die einzelnen Lebensmittel.
Regeln:
- Nur, was gesagt wurde. Keine Lebensmittel ergänzen, keine Nährwerte angeben.
- quantity und unit genau so, wie gesagt ("200 Gramm Skyr" -> 200, "g"; "eine Banane" -> 1, "Stück"; "zwei Esslöffel Öl" -> 2, "EL").
- Ohne genannte Menge: quantity null, quantityStatus "unknown". Ungefähre Mengen ("etwa", "eine Handvoll"): quantityStatus "estimated".
- name: das Lebensmittel als kurzer Suchbegriff ohne Menge (z. B. "Skyr", "Haferflocken", "Banane").
- transcript: der verstandene Satz wörtlich.
Antworte ausschließlich mit JSON: {"transcript":string,"items":[{"name":string,"quantity":number|null,"unit":string|null,"quantityStatus":"read"|"estimated"|"unknown"}]}`;

export interface VoiceItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  quantityStatus: CaptureStatus;
  candidates: FoodCandidate[];
}

export interface VoicePreview {
  transcript: string;
  items: VoiceItem[];
}

export async function toVoicePreview(ai: VoiceAi, match: FoodMatcher): Promise<VoicePreview> {
  const items = await Promise.all(
    ai.items.map(async (item) => {
      const unit = normalizeUnit(item.unit);
      const quantity = item.quantity === null ? null : item.quantity * (unit?.factor ?? 1);
      return {
        name: item.name,
        quantity,
        unit: unit?.label ?? (quantity !== null ? "Stück" : null),
        quantityStatus: (quantity === null ? "unknown" : item.quantityStatus === "read" ? "verified" : item.quantityStatus) as CaptureStatus,
        candidates: await match(item.name),
      };
    }),
  );
  return { transcript: ai.transcript, items };
}

export async function parseVoice(callGemini: GeminiCaller, match: FoodMatcher, input: { audio?: GeminiMedia; text?: string }): Promise<VoicePreview> {
  const prompt = input.text ? `${VOICE_PROMPT}\nText: ${JSON.stringify(input.text)}` : VOICE_PROMPT;
  const answer = await callGemini({ prompt, media: input.audio ? [input.audio] : [], timeoutMs: 45_000 });
  return toVoicePreview(parseAiAnswer(voiceAiSchema, answer, "Spracheingabe"), match);
}
