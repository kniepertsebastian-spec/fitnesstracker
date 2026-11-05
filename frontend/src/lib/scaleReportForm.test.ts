import { describe, expect, it } from "vitest";
import type { ScaleReportDraft } from "@fitnesstracker/shared";
import { draftToTexts, textsToInput } from "./scaleReportForm";

// Made-up numbers that satisfy the report's own rules (100.0 - 22.6 = 77.4 = 56.7 + 15.5 + 5.2).
const draft: ScaleReportDraft = {
  measuredAt: "2026-07-12T05:30:15.000Z",
  weightKg: 100,
  bodyFatPercent: 22.6,
  muscleMassKg: 72.2,
  bodyWaterPercent: 56.7,
  heightCm: 180,
  ageYears: 31,
  details: {
    source: "fitdays-report",
    fatMassKg: 22.6,
    fatFreeMassKg: 77.4,
    boneMassKg: 5.2,
    proteinKg: 15.5,
    waterKg: 56.7,
    skeletalMuscleKg: 45.1,
    visceralFat: 11,
    impedance: {
      khz20: { rightArm: 270, leftArm: 268, trunk: 26, rightLeg: 155, leftLeg: 135 },
      khz100: { rightArm: 240, leftArm: 238, trunk: 24, rightLeg: 125, leftLeg: 110 },
    },
  },
  checks: [],
  uncertain: ["Viszeralfett"],
};

describe("scale report form", () => {
  it("shows the draft as German decimal texts and gets the same payload back", () => {
    const texts = draftToTexts(draft);
    expect(texts.weightKg).toBe("100");
    expect(texts["details.fatMassKg"]).toBe("22,6");
    expect(texts["details.impedance.khz20.trunk"]).toBe("26");
    expect(texts["details.asmi"]).toBe(""); // not in the draft

    const result = textsToInput(draft, texts);
    expect(result).toEqual({
      ok: true,
      input: {
        measuredAt: draft.measuredAt,
        weightKg: 100,
        bodyFatPercent: 22.6,
        muscleMassKg: 72.2,
        bodyWaterPercent: 56.7,
        details: draft.details,
      },
    });
  });

  it("takes corrections made by the user", () => {
    const texts = { ...draftToTexts(draft), "details.visceralFat": "9", weightKg: "100,5" };
    const result = textsToInput(draft, texts);
    expect(result.ok && result.input.weightKg).toBe(100.5);
    expect(result.ok && result.input.details.visceralFat).toBe(9);
  });

  it("drops an impedance band that is incomplete instead of storing half of it", () => {
    const texts = { ...draftToTexts(draft), "details.impedance.khz100.leftLeg": "" };
    const result = textsToInput(draft, texts);
    expect(result.ok && result.input.details.impedance).toEqual({ khz20: draft.details.impedance?.khz20 });
  });

  it("names a field that is not a number, and refuses values the server would refuse", () => {
    expect(textsToInput(draft, { ...draftToTexts(draft), "details.boneMassKg": "5,x" })).toEqual({ ok: false, message: "„Knochenmasse“ ist keine Zahl." });
    expect(textsToInput(draft, { ...draftToTexts(draft), bodyFatPercent: "250" })).toEqual({ ok: false, message: "Bitte „Körperfett (%)“ prüfen." });
    expect(textsToInput(draft, { ...draftToTexts(draft), weightKg: "" }).ok).toBe(false);
  });
});
