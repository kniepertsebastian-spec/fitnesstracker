import { ConflictError } from "../../errors/httpErrors.js";
// Reads a Fitdays body-composition report ("Analysebericht zur Körperzusammensetzung") from the
// text Tesseract makes of a screenshot. No AI involved: the report has a fixed layout, so the values
// are found by their position and by anchors that OCR reads reliably (the "Testzeit" header, the
// value-plus-range pattern of the table, the "Grundumsatz 2285 kcal" lines, the impedance rows).
//
// OCR garbles some labels ("fette Masse" comes out as "Rio Heese") and now and then a single digit,
// so nothing is taken on trust: the draft carries plausibility checks (the values must add up the
// way the report's own rules say), and the screen shows every number for correction before saving.
const num = (text) => Number(text.replace(",", "."));
const round1 = (value) => Math.round(value * 10) / 10;
// Offset of `timeZone` from UTC at the given instant, in ms (positive east of Greenwich).
function zoneOffsetMs(instant, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(instant);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(instant.getTime() / 1000) * 1000;
}
// The wall-clock time on the phone (no zone in the report) as an instant.
export function localTimeToUtc(year, month, day, hour, minute, second, timeZone) {
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const first = asUtc - zoneOffsetMs(new Date(asUtc), timeZone);
    const second_ = asUtc - zoneOffsetMs(new Date(first), timeZone);
    return new Date(second_);
}
function parseTestTime(text, timeZone) {
    const match = /Testzeit\s*:?\s*(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})\s+(\d{1,2}):(\d{2}):(\d{2})/i.exec(text);
    if (!match)
        throw new ConflictError("Im Bild wurde keine Testzeit gefunden. Ist es ein Fitdays-Analysebericht?");
    const [a, b, c] = [Number(match[1]), Number(match[2]), Number(match[3])];
    let year;
    let month;
    let day;
    if (a > 31) {
        [year, month, day] = [a, b, c]; // 2026-11-05
    }
    else {
        year = c;
        // 05/11/2026 is day first (the report is in German); only "11/25/2026" can be month first.
        [day, month] = b > 12 && a <= 12 ? [b, a] : [a, b];
    }
    const date = localTimeToUtc(year, month, day, Number(match[4]), Number(match[5]), Number(match[6]), timeZone);
    if (Number.isNaN(date.getTime()))
        throw new ConflictError("Die Testzeit im Bild ist nicht lesbar.");
    return date;
}
// "119.1 (64.0-86.6) 100.0" and OCR variants such as "5.9 (8.7.4.6) 5:0": the number before a
// bracketed range, and the share printed behind it (when OCR got it right).
const TABLE_ROW = /(\d{1,3}[.,]\d)\s*\(\s*[\d.,]+\s*[-–.]\s*[\d.,]+\s*\)\s*(\d{1,3}[.,]\d)?/g;
function impedanceSet(text, kilohertz) {
    const row = new RegExp(`(?:^|\\s)${kilohertz}\\s*\\(\\s*kHz\\s*\\)\\s+((?:\\d{1,4}[.,]\\d\\s+){4}\\d{1,4}[.,]\\d)`, "im").exec(text);
    if (!row)
        return undefined;
    const [rightArm, leftArm, trunk, rightLeg, leftLeg] = row[1].split(/\s+/).map(num);
    return { rightArm, leftArm, trunk, rightLeg, leftLeg };
}
function find(text, pattern) {
    const match = pattern.exec(text);
    return match ? num(match[1]) : undefined;
}
function parseScore(text) {
    // "93 /100 Punkte"; OCR sometimes splits the digits: "8 6 /100 Punkte".
    const match = /(\d{1,3}|\d\s\d)\s*\/\s*100\s*Punkte/i.exec(text);
    if (!match)
        return undefined;
    const value = Number(match[1].replace(/\s/g, ""));
    return value >= 0 && value <= 150 ? value : undefined;
}
export function parseFitdaysReport(ocrText, timeZone) {
    const measuredAt = parseTestTime(ocrText, timeZone);
    const rows = [...ocrText.matchAll(TABLE_ROW)].map((m) => ({ value: num(m[1]), printedPercent: m[2] ? num(m[2]) : undefined }));
    if (rows.length < 7) {
        throw new ConflictError(`Aus dem Bild konnten nur ${rows.length} von 7 Zeilen der Körperzusammensetzung gelesen werden. Bitte einen vollständigen, scharfen Screenshot des ganzen Berichts hochladen.`);
    }
    // Fixed order of the report's table.
    const [weight, fatMass, bone, protein, water, muscle, skeletal] = rows;
    const weightKg = weight.value;
    const share = (row) => {
        const computed = round1((row.value / weightKg) * 100);
        // The printed share wins when OCR read it and it agrees with the masses; otherwise the computed one.
        return row.printedPercent !== undefined && Math.abs(row.printedPercent - computed) <= 0.2 ? row.printedPercent : computed;
    };
    const impedance20 = impedanceSet(ocrText, 20);
    const impedance100 = impedanceSet(ocrText, 100);
    const fatFreeMassKg = find(ocrText, /Fettfreies\s+K[öo]rpergewicht\s+(\d{2,3}[.,]\d)/i);
    const details = {
        source: "fitdays-report",
        fatMassKg: fatMass.value,
        ...(fatFreeMassKg !== undefined ? { fatFreeMassKg } : {}),
        boneMassKg: bone.value,
        proteinKg: protein.value,
        waterKg: water.value,
        skeletalMuscleKg: skeletal.value,
    };
    const optional = {
        subcutaneousFatPercent: find(ocrText, /Subkutanes\s+Fett\s+(\d{1,2}[.,]\d)/i),
        visceralFat: find(ocrText, /Viszeral\w*\s+Fettgehalt\s+(\d{1,2})\b/i),
        basalMetabolicRateKcal: find(ocrText, /Grundumsatz\s+(\d{3,4})\s*kcal/i),
        bodyAge: find(ocrText, /K[öo]rperalter\s+(\d{1,3})\b/i),
        asmi: find(ocrText, /ASMI\s+(\d{1,2}[.,]\d)/i),
        waistHipRatio: find(ocrText, /WHR\s+(\d[.,]\d{1,2})/i),
        score: parseScore(ocrText),
    };
    for (const [key, value] of Object.entries(optional)) {
        if (value !== undefined)
            details[key] = value;
    }
    if (impedance20 || impedance100)
        details.impedance = { ...(impedance20 ? { khz20: impedance20 } : {}), ...(impedance100 ? { khz100: impedance100 } : {}) };
    const ffm = fatFreeMassKg ?? round1(weightKg - fatMass.value);
    const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance + 1e-6;
    const checks = [
        { key: "fatFree", label: "Fettfreie Masse = Gewicht − Fettmasse", ok: near(ffm, weightKg - fatMass.value, 0.25) },
        { key: "muscle", label: "Muskelmasse + Knochenmasse = fettfreie Masse", ok: near(muscle.value + bone.value, ffm, 0.25) },
        { key: "water", label: "Wasser + Eiweiß + Knochen = fettfreie Masse", ok: near(water.value + protein.value + bone.value, ffm, 0.35) },
        {
            key: "fatShare",
            label: "Körperfett % passt zu Fettmasse ÷ Gewicht",
            ok: fatMass.printedPercent === undefined || near(fatMass.printedPercent, (fatMass.value / weightKg) * 100, 0.2),
        },
    ];
    if (impedance20 && impedance100) {
        const channels = ["rightArm", "leftArm", "trunk", "rightLeg", "leftLeg"];
        checks.push({
            key: "impedance",
            label: "Impedanz bei 20 kHz ist je Segment höher als bei 100 kHz",
            ok: channels.every((c) => impedance20[c] > impedance100[c]),
        });
    }
    else {
        checks.push({ key: "impedance", label: "Beide Impedanzzeilen (20 und 100 kHz) gefunden", ok: false });
    }
    const uncertainLabels = {
        subcutaneousFatPercent: "Subkutanes Fett",
        visceralFat: "Viszeralfett",
        basalMetabolicRateKcal: "Grundumsatz",
        bodyAge: "Körperalter",
        asmi: "ASMI",
        waistHipRatio: "WHR",
        score: "Körperpunktzahl",
    };
    return {
        measuredAt: measuredAt.toISOString(),
        weightKg,
        bodyFatPercent: share(fatMass),
        muscleMassKg: muscle.value,
        bodyWaterPercent: share(water),
        heightCm: find(ocrText, /H[öo]he\s*:\s*(\d{2,3})\s*cm/i) ?? null,
        ageYears: find(ocrText, /Alter\s*:\s*(\d{1,3})\b/i) ?? null,
        details,
        checks,
        uncertain: Object.entries(uncertainLabels)
            .filter(([key]) => optional[key] !== undefined)
            .map(([, label]) => label),
    };
}
//# sourceMappingURL=scaleReport.parser.js.map