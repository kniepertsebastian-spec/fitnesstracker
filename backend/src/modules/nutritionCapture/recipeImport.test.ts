import { describe, expect, it } from "vitest";
import { recipeDraftAiSchema } from "@fitnesstracker/shared";
import type { FoodCandidate } from "./foodMatch.js";
import { searchQueryFor } from "./foodMatch.js";
import { detectPlatform, draftFromAi, draftFromJsonLd, recipePrompt } from "./recipeImport.service.js";

const matcher = async (name: string) => (name.includes("Drachenfrucht") ? [] : [{ id: `id-${name}`, name } as unknown as FoodCandidate]);

describe("detectPlatform", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://youtu.be/abc", "youtube"],
    ["https://m.youtube.com/shorts/abc", "youtube"],
    ["https://www.tiktok.com/@koch/video/1", "tiktok"],
    ["https://vm.tiktok.com/xyz", "tiktok"],
    ["https://www.instagram.com/reel/abc/", "instagram"],
    ["https://www.chefkoch.de/rezepte/1/x.html", "web"],
    ["https://notyoutube.com/x", "web"],
    ["kein link", "web"],
  ])("%s -> %s", (url, platform) => {
    expect(detectPlatform(url)).toBe(platform);
  });
});

describe("draftFromJsonLd (no AI)", () => {
  it("parses the author's ingredient lines and asks about what is missing", async () => {
    const draft = await draftFromJsonLd(
      {
        name: "Protein-Pasta",
        yield: "2 Portionen",
        ingredients: ["250 g Vollkornnudeln", "10 ml Olivenöl", "2-3 Knoblauchzehen", "Salz und Pfeffer", "1 Drachenfrucht"],
        instructions: ["Nudeln kochen.", "Mit Öl mischen."],
      },
      null,
      matcher,
    );
    expect(draft.method).toBe("json-ld");
    expect(draft.title).toBe("Protein-Pasta");
    expect(draft.servings).toEqual({ value: 2, status: "verified" });
    expect(draft.ingredients.map((i) => [i.name, i.quantity, i.unit, i.status])).toEqual([
      ["Vollkornnudeln", 250, "g", "verified"],
      ["Olivenöl", 10, "ml", "verified"],
      ["Knoblauchzehen", 2.5, "Stück", "estimated"],
      ["Salz und Pfeffer", null, null, "unknown"],
      ["Drachenfrucht", 1, "Stück", "verified"],
    ]);
    expect(draft.openQuestions).toEqual([
      "Menge für „Knoblauchzehen“ ist geschätzt – stimmt 2,5 Stück?",
      "Menge für „Salz und Pfeffer“?",
      "Kein passendes Lebensmittel für „Drachenfrucht“ gefunden.",
    ]);
    expect(draft.steps).toEqual(["Nudeln kochen.", "Mit Öl mischen."]);
  });

  it("asks for the servings when the page gives none", async () => {
    const draft = await draftFromJsonLd({ name: null, yield: null, ingredients: ["100 g Reis"], instructions: [] }, "Titel aus der Vorschau", matcher);
    expect(draft.title).toBe("Titel aus der Vorschau");
    expect(draft.servings).toEqual({ value: null, status: "unknown" });
    expect(draft.openQuestions).toContain("Wie viele Portionen ergibt das Rezept?");
  });
});

describe("draftFromAi", () => {
  it("keeps the AI's uncertainty: unknown amounts stay empty, estimated ones are asked about", async () => {
    const ai = recipeDraftAiSchema.parse({
      title: "Shakshuka",
      servings: { value: 2, status: "read" },
      ingredients: [
        { name: "Eier", quantity: 4, unit: "Stück", status: "read" },
        { name: "Tomaten", quantity: 0.4, unit: "kg", status: "estimated", note: "im Video geschätzt" },
        { name: "Feta", quantity: 100, unit: "g", status: "unknown" },
        { name: "Kreuzkümmel", quantity: null, unit: null, status: "read" },
      ],
      steps: ["Tomaten einkochen."],
      openQuestions: ["Welche Paprika?"],
    });
    const draft = await draftFromAi(ai, null, matcher);
    expect(draft.method).toBe("ai");
    expect(draft.ingredients.map((i) => [i.name, i.quantity, i.unit, i.status])).toEqual([
      ["Eier", 4, "Stück", "verified"],
      ["Tomaten", 400, "g", "estimated"],
      ["Feta", null, "g", "unknown"],
      ["Kreuzkümmel", null, null, "unknown"],
    ]);
    expect(draft.ingredients[1]!.note).toBe("im Video geschätzt");
    expect(draft.openQuestions).toEqual([
      "Welche Paprika?",
      "Menge für „Tomaten“ ist geschätzt – stimmt 400 g?",
      "Menge für „Feta“?",
      "Menge für „Kreuzkümmel“?",
    ]);
  });

  it("never carries nutrients: the schema has none and the prompt forbids them", () => {
    const ai = recipeDraftAiSchema.parse({ title: "x", servings: {}, ingredients: [{ name: "Reis", quantity: 100, unit: "g", status: "read", kcal: 350 }] });
    expect(Object.keys(ai.ingredients[0]!)).not.toContain("kcal");
    expect(recipePrompt("text")).toMatch(/keine Nährwerte/);
  });
});

describe("searchQueryFor", () => {
  it("drops preparation words and notes", () => {
    expect(searchQueryFor("große Zwiebeln, fein gehackt")).toBe("Zwiebeln");
    expect(searchQueryFor("Hähnchenbrust (ohne Haut)")).toBe("Hähnchenbrust");
    expect(searchQueryFor("frischer Spinat")).toBe("Spinat");
  });
});
