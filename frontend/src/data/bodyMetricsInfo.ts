import type { Gender } from "@fitnesstracker/shared";

// Rough, widely-cited orientation bands (ACE body-fat categories) — not a medical assessment,
// just enough context to read a raw percentage. Body fat % ranges differ meaningfully by sex,
// hence the Gender parameter; without a saved profile there's no basis to pick one, so the
// category is left out rather than guessed.
const BODY_FAT_BANDS: Record<Gender, { max: number; label: string }[]> = {
  MALE: [
    { max: 5, label: "essentiell" },
    { max: 13, label: "athletisch" },
    { max: 17, label: "fit" },
    { max: 24, label: "durchschnittlich" },
    { max: Infinity, label: "erhöht" },
  ],
  FEMALE: [
    { max: 13, label: "essentiell" },
    { max: 20, label: "athletisch" },
    { max: 24, label: "fit" },
    { max: 31, label: "durchschnittlich" },
    { max: Infinity, label: "erhöht" },
  ],
};

export function categorizeBodyFat(percent: number, gender: Gender | undefined): string | null {
  if (!gender) return null;
  const band = BODY_FAT_BANDS[gender].find((b) => percent <= b.max);
  return band?.label ?? null;
}

export const BODY_METRIC_INFO = {
  weightKg: {
    label: "Gewicht",
    description:
      "Allein wenig aussagekräftig — der Trend über mehrere Wochen zählt mehr als ein einzelner Wert (Tagesschwankungen durch Wasser/Essen sind normal).",
  },
  bodyFatPercent: {
    label: "Körperfett",
    description:
      "Grobe Orientierung, keine medizinische Messung — Waagen schätzen per Bioimpedanz, die Genauigkeit schwankt mit Hydration/Tageszeit. Einordnung unten (falls Geschlecht im Profil hinterlegt) nach gängigen Fitness-Kategorien.",
  },
  muscleMassKg: {
    label: "Muskelmasse",
    description:
      "Stark geräteabhängig, kein einheitlicher Referenzbereich — der Trend über Zeit ist aussagekräftiger als der Absolutwert.",
  },
  bodyWaterPercent: {
    label: "Wasseranteil",
    description: "Üblicher Bereich bei Erwachsenen etwa 45-65 % — sinkt tendenziell mit höherem Körperfettanteil.",
  },
} as const;
