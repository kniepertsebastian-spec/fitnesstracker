import { describe, expect, it } from "vitest";
import { voiceAiSchema } from "@fitnesstracker/shared";
import type { FoodCandidate } from "./foodMatch.js";
import { parseVoice, toVoicePreview } from "./voice.service.js";

const candidate = (name: string): FoodCandidate => ({
  id: `id-${name}`,
  name,
  brand: null,
  source: "BLS",
  own: false,
  basis: "PER_100G",
  densityGPerMl: null,
  per100: { values: { kcal: 64, proteinG: 10, carbsG: 3, fatG: 1, fiberG: null, sugarG: null, saturatedFatG: null, saltG: null }, estimated: [] },
  estimatedFields: [],
  units: [],
} as unknown as FoodCandidate);

const matcher = async (name: string) => (name === "Unbekanntes" ? [] : [candidate(name)]);

describe("toVoicePreview", () => {
  it("normalises units and matches every food, without nutrients from the AI", async () => {
    const ai = voiceAiSchema.parse({
      transcript: "200 Gramm Skyr, eine Banane und ungefähr zwei Esslöffel Haferflocken",
      items: [
        { name: "Skyr", quantity: 200, unit: "Gramm", quantityStatus: "read" },
        { name: "Banane", quantity: 1, unit: null, quantityStatus: "read" },
        { name: "Haferflocken", quantity: 2, unit: "Esslöffel", quantityStatus: "estimated" },
      ],
    });
    const preview = await toVoicePreview(ai, matcher);
    expect(preview.items.map((i) => [i.name, i.quantity, i.unit, i.quantityStatus])).toEqual([
      ["Skyr", 200, "g", "verified"],
      ["Banane", 1, "Stück", "verified"],
      ["Haferflocken", 2, "EL", "estimated"],
    ]);
    expect(preview.items[0]!.candidates[0]!.id).toBe("id-Skyr");
  });

  it("keeps a missing amount unknown and an unmatched food without candidates", async () => {
    const ai = voiceAiSchema.parse({ transcript: "x", items: [{ name: "Unbekanntes", quantity: null, unit: null, quantityStatus: "read" }] });
    const [item] = (await toVoicePreview(ai, matcher)).items;
    expect(item).toMatchObject({ quantity: null, unit: null, quantityStatus: "unknown", candidates: [] });
  });

  it("converts kilograms and litres", async () => {
    const ai = voiceAiSchema.parse({ transcript: "x", items: [{ name: "Milch", quantity: 0.5, unit: "Liter", quantityStatus: "read" }] });
    expect((await toVoicePreview(ai, matcher)).items[0]).toMatchObject({ quantity: 500, unit: "ml" });
  });
});

describe("parseVoice", () => {
  it("sends typed text in the prompt and no media", async () => {
    const seen: { prompt: string; media?: unknown[] }[] = [];
    await parseVoice(async (req) => {
      seen.push(req);
      return { transcript: "Quark", items: [] };
    }, matcher, { text: "250 g Quark" });
    expect(seen[0]!.prompt).toContain('"250 g Quark"');
    expect(seen[0]!.media).toEqual([]);
  });
});
