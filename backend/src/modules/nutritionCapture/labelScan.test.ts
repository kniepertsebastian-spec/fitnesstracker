import { labelScanAiSchema } from "@fitnesstracker/shared";
import { describe, expect, it } from "vitest";
import { scanNutritionLabel, toLabelScanDraft } from "./labelScan.service.js";

const read = (value: number) => ({ value, status: "read" });

describe("labelScanAiSchema (no hallucination)", () => {
  it("turns a missing nutrient into unknown and drops a number marked unknown", () => {
    const ai = labelScanAiSchema.parse({
      name: "Proteinriegel",
      basis: "PER_100G",
      nutrients: { kcal: read(380), proteinG: read(30), carbsG: { value: 12, status: "unknown" }, fatG: { value: null, status: "read" } },
    });
    expect(ai.nutrients.carbsG).toEqual({ value: null, status: "unknown" });
    expect(ai.nutrients.fatG).toEqual({ value: null, status: "unknown" });
    expect(ai.nutrients.fiberG).toEqual({ value: null, status: "unknown" });
    expect(ai.nutrients.kcal).toEqual({ value: 380, status: "read" });
  });

  it("does not accept nonsense values", () => {
    const ai = labelScanAiSchema.parse({ nutrients: { kcal: { value: -5, status: "read" }, proteinG: { value: "viel", status: "estimated" } } });
    expect(ai.nutrients.kcal.status).toBe("unknown");
    expect(ai.nutrients.proteinG.status).toBe("unknown");
    expect(ai.name).toBeNull();
    expect(ai.basis).toBeNull();
  });
});

describe("toLabelScanDraft", () => {
  const ai = labelScanAiSchema.parse({
    name: "Skyr Natur",
    brand: "Testmarke",
    basis: "PER_100G",
    nutrients: {
      kcal: read(63),
      proteinG: read(11),
      carbsG: read(4),
      fatG: read(0.2),
      sugarG: read(4),
      saturatedFatG: { value: 0.1, status: "estimated" },
      saltG: { value: 0.1, status: "estimated" },
    },
    packageSize: { value: 450, unit: "g", status: "read" },
    servingSize: { value: 150, unit: "g", label: "Becher", status: "read" },
  });

  it("maps read -> verified, keeps estimated, unknown stays empty", () => {
    const draft = toLabelScanDraft(ai, { barcode: "4012345678901" });
    expect(draft.per100.kcal).toBe(63);
    expect(draft.status.kcal).toBe("verified");
    expect(draft.status.saturatedFatG).toBe("estimated");
    expect(draft.per100.fiberG).toBeNull();
    expect(draft.status.fiberG).toBe("unknown");
    expect(draft.estimatedFields).toEqual(["saturatedFatG", "saltG"]);
    expect(draft.barcode).toBe("4012345678901");
    expect(draft.plausibility.ok).toBe(true);
  });

  it("suggests the package and the serving as measures", () => {
    const draft = toLabelScanDraft(ai, {});
    expect(draft.suggestedUnits).toEqual([
      { label: "Packung", baseAmount: 450, status: "verified" },
      { label: "Becher", baseAmount: 150, status: "verified" },
    ]);
  });

  it("ignores a package size in the wrong unit (ml on a per-100-g label)", () => {
    const other = labelScanAiSchema.parse({ basis: "PER_100G", nutrients: {}, packageSize: { value: 500, unit: "ml", status: "read" } });
    expect(toLabelScanDraft(other, {}).suggestedUnits).toEqual([]);
  });

  it("uses the spoken name when the photo shows none, and never invents one", () => {
    const nameless = labelScanAiSchema.parse({ nutrients: {} });
    expect(toLabelScanDraft(nameless, { productName: "Hafer-Drink" }).name).toBe("Hafer-Drink");
    const draft = toLabelScanDraft(nameless, {});
    expect(draft.name).toBeNull();
    expect(draft.nameStatus).toBe("unknown");
  });

  it("assumes per 100 g when the basis is not legible, and says so", () => {
    const draft = toLabelScanDraft(labelScanAiSchema.parse({ nutrients: {} }), {});
    expect(draft.basis).toBe("PER_100G");
    expect(draft.basisStatus).toBe("estimated");
    expect(draft.notes.join(" ")).toMatch(/100 g angenommen/);
  });

  it("marks a misread label for review", () => {
    const misread = labelScanAiSchema.parse({ basis: "PER_100G", nutrients: { kcal: read(630), proteinG: read(11), carbsG: read(4), fatG: read(0.2) } });
    const draft = toLabelScanDraft(misread, {});
    expect(draft.plausibility.ok).toBe(false);
    expect(draft.plausibility.suspiciousFields).toContain("kcal");
  });
});

describe("scanNutritionLabel", () => {
  it("sends the label (and front) photo and validates the answer", async () => {
    const calls: { prompt: string; media: number }[] = [];
    const draft = await scanNutritionLabel(
      async (req) => {
        calls.push({ prompt: req.prompt, media: req.media?.length ?? 0 });
        return { name: null, basis: "PER_100ML", nutrients: { kcal: read(42), proteinG: read(1), carbsG: read(9), fatG: read(0) } };
      },
      { label: { mimeType: "image/jpeg", data: Buffer.from("a") }, front: { mimeType: "image/jpeg", data: Buffer.from("b") }, productName: "Apfelschorle" },
    );
    expect(calls[0]!.media).toBe(2);
    expect(calls[0]!.prompt).toContain("Apfelschorle");
    expect(draft.basis).toBe("PER_100ML");
    expect(draft.name).toBe("Apfelschorle");
  });

  it("rejects an answer that is not the expected JSON", async () => {
    await expect(scanNutritionLabel(async () => ["nope"], { label: { mimeType: "image/png", data: Buffer.from("x") } })).rejects.toThrow(/Format/);
  });
});
