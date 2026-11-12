import { describe, expect, it } from "vitest";
import { localTimeToUtc, parseFitdaysReport } from "./scaleReport.parser.js";
// Text shaped like Tesseract's output for a Fitdays report (columns run into each other, some labels
// and digits are garbled), with made-up numbers that satisfy the report's own rules:
// 100.0 - 22.6 = 77.4 = 56.7 + 15.5 + 5.2, and 72.2 + 5.2 = 77.4.
function ocr(overrides = {}) {
    const rows = [
        `Gewicht ${overrides.weight ?? "100.0"} (64.0-86.6) 100.0 Hoch 8 6 /100 Punkte`,
        `(Rio Heese 22.6 (9.0-18.1) ${overrides.fatShare ?? "22.6"} Hoch *Die Gesamtpunktzahl spiegelt den bewerteten Wert der`,
        `. Körperzusammensetzung wider.`,
        `Küoclienmasse 5.2 (8.7.4.6) 5:0 Ausgezeichnet Eine muskulöse Person kann mehr als 100 Punkte`,
        `Eiweißmenge 15.5 (11.0-13.7) 15.5 Ausgezeichnet bekommen.`,
        `Wassergehalt ${overrides.water ?? "56.7"} (40.3-50.2) 56.7 Ausgezeichnet Gewichtskontrolle`,
        `Muskelmasse 72.2 (51.3-63.9) 72.2 Ausgezeichnet`,
        `Skelettmuskel 45.1 (32.4-39.6) 45.1 Ausgezeichnet Empfohlenes Zielgewicht 90.1 kg`,
    ];
    return [
        "Analysebericht zur Körperzusammensetzung Fitdays",
        `ID:test Geschlecht:Männlich Alter:31 Höhe:180cm Testzeit:${overrides.testTime ?? "12/07/2026 07:30:15"}`,
        "Analyse der Körperzusammensetzung Körperpunktzahl",
        ...(overrides.skipRows ? rows.slice(0, 4) : rows),
        "Adipositasanalyse",
        "Andere Indikatoren",
        "Segmentale Fettanalyse Muskelbalance Viszeraler Fettgehalt 11",
        "Standardbereich: Grundumsatz 2100 kcal",
        "Fettfreies Körpergewicht 77.4 kg",
        "Bioelektrische Impedanz Subkutanes Fett 15.0 %",
        "ASMI 10.9 kg/m?",
        "20(kHz) 270.0 268.0 26.0 155.0 135.0 Körperalter 31",
        `100(kHz) ${overrides.impedance100 ?? "240.0 238.0 24.0 125.0 110.0"} WHR 0.80`,
    ].join("\n");
}
describe("parseFitdaysReport", () => {
    it("reads values, share, test time (in the phone's time zone), impedances and the other indicators", () => {
        const draft = parseFitdaysReport(ocr(), "Europe/Berlin");
        expect(draft).toMatchObject({
            // 07:30:15 in Berlin in July is UTC+2.
            measuredAt: "2026-07-12T05:30:15.000Z",
            weightKg: 100,
            bodyFatPercent: 22.6,
            muscleMassKg: 72.2,
            bodyWaterPercent: 56.7,
            heightCm: 180,
            ageYears: 31,
        });
        expect(draft.details).toEqual({
            source: "fitdays-report",
            fatMassKg: 22.6,
            fatFreeMassKg: 77.4,
            boneMassKg: 5.2,
            proteinKg: 15.5,
            waterKg: 56.7,
            skeletalMuscleKg: 45.1,
            subcutaneousFatPercent: 15,
            visceralFat: 11,
            basalMetabolicRateKcal: 2100,
            bodyAge: 31,
            asmi: 10.9,
            waistHipRatio: 0.8,
            score: 86, // "8 6 /100" is read as 86
            impedance: {
                khz20: { rightArm: 270, leftArm: 268, trunk: 26, rightLeg: 155, leftLeg: 135 },
                khz100: { rightArm: 240, leftArm: 238, trunk: 24, rightLeg: 125, leftLeg: 110 },
            },
        });
    });
    it("passes every plausibility check on a consistent report and lists the values no check covers", () => {
        const draft = parseFitdaysReport(ocr(), "Europe/Berlin");
        expect(draft.checks.every((c) => c.ok)).toBe(true);
        expect(draft.uncertain).toEqual(["Subkutanes Fett", "Viszeralfett", "Grundumsatz", "Körperalter", "ASMI", "WHR", "Körperpunktzahl"]);
    });
    it("flags a misread digit through the report's own rules", () => {
        // Water read as 60.7 instead of 56.7: water + protein + bone no longer equals the fat-free mass.
        const draft = parseFitdaysReport(ocr({ water: "60.7" }), "Europe/Berlin");
        expect(draft.checks.find((c) => c.key === "water")?.ok).toBe(false);
        expect(draft.checks.find((c) => c.key === "muscle")?.ok).toBe(true);
    });
    it("falls back to the computed share when the printed one is garbled or contradicts the masses", () => {
        const garbled = parseFitdaysReport(ocr({ fatShare: "2Z.6" }), "Europe/Berlin");
        expect(garbled.bodyFatPercent).toBe(22.6);
        const wrong = parseFitdaysReport(ocr({ fatShare: "29.9" }), "Europe/Berlin");
        expect(wrong.bodyFatPercent).toBe(22.6);
        expect(wrong.checks.find((c) => c.key === "fatShare")?.ok).toBe(false);
    });
    it("fails the impedance check when a 100 kHz value is above its 20 kHz value", () => {
        const draft = parseFitdaysReport(ocr({ impedance100: "240.0 238.0 24.0 175.0 110.0" }), "Europe/Berlin");
        expect(draft.checks.find((c) => c.key === "impedance")?.ok).toBe(false);
    });
    it("reads the winter time offset and other date notations", () => {
        expect(parseFitdaysReport(ocr({ testTime: "05/11/2026 06:17:59" }), "Europe/Berlin").measuredAt).toBe("2026-11-05T05:17:59.000Z");
        expect(parseFitdaysReport(ocr({ testTime: "2026-11-05 06:17:59" }), "Europe/Berlin").measuredAt).toBe("2026-11-05T05:17:59.000Z");
        expect(parseFitdaysReport(ocr({ testTime: "11/25/2026 06:17:59" }), "Europe/Berlin").measuredAt).toBe("2026-11-25T05:17:59.000Z");
    });
    it("refuses text that is not a Fitdays report or lacks the table", () => {
        expect(() => parseFitdaysReport("Einkaufsliste: Milch, Brot", "Europe/Berlin")).toThrow(/Testzeit/);
        expect(() => parseFitdaysReport(ocr({ skipRows: true }), "Europe/Berlin")).toThrow(/3 von 7/);
    });
});
describe("localTimeToUtc", () => {
    it("converts wall-clock time with the zone's offset at that date", () => {
        expect(localTimeToUtc(2026, 10, 18, 6, 42, 7, "Europe/Berlin").toISOString()).toBe("2026-10-18T04:42:07.000Z"); // CEST, +2
        expect(localTimeToUtc(2026, 11, 5, 6, 17, 59, "Europe/Berlin").toISOString()).toBe("2026-11-05T05:17:59.000Z"); // CET, +1
        expect(localTimeToUtc(2026, 7, 1, 12, 0, 0, "America/New_York").toISOString()).toBe("2026-07-01T16:00:00.000Z");
        expect(localTimeToUtc(2026, 7, 1, 12, 0, 0, "UTC").toISOString()).toBe("2026-07-01T12:00:00.000Z");
    });
});
//# sourceMappingURL=scaleReport.parser.test.js.map