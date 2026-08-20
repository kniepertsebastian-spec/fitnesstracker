// Curated, static — same reasoning as the nutrition tips in Phase 8: an honest fixed list
// beats an API call that wouldn't add real freshness or personalization here.
export type SupplementRating = "effective" | "situational" | "overrated";

export interface SupplementReferenceEntry {
  name: string;
  description: string;
  rating: SupplementRating;
  dosage: string;
}

export const SUPPLEMENT_REFERENCE: SupplementReferenceEntry[] = [
  {
    name: "Kreatin (Monohydrat)",
    description:
      "Erhöht die Phosphokreatin-Speicher im Muskel, verbessert Kraft und Leistung bei kurzen, intensiven Belastungen. Eines der am besten erforschten Supplements überhaupt.",
    rating: "effective",
    dosage: "3-5 g täglich, dauerhaft (kein Aufladen nötig)",
  },
  {
    name: "Whey-Protein",
    description:
      "Praktische, schnell verfügbare Proteinquelle — wirkt nur über die Gesamt-Proteinzufuhr, nicht durch die Quelle selbst. Sinnvoll, wenn Protein über Lebensmittel schwer zu decken ist.",
    rating: "effective",
    dosage: "Je nach Bedarf zur Proteinzufuhr, z. B. 20-40 g pro Portion",
  },
  {
    name: "Koffein",
    description:
      "Steigert Wachheit, Kraft- und Ausdauerleistung kurzfristig zuverlässig. Toleranz entwickelt sich bei täglichem Konsum.",
    rating: "effective",
    dosage: "3-6 mg/kg Körpergewicht, 30-60 Min. vor dem Training",
  },
  {
    name: "Beta-Alanin",
    description:
      "Puffert Muskelübersäuerung, hilft bei Belastungen im Bereich von 1-4 Minuten. Kribbeln (Parästhesie) ist harmlos.",
    rating: "situational",
    dosage: "3-6 g täglich, aufgeteilt auf mehrere Portionen",
  },
  {
    name: "Citrullin-Malat",
    description:
      "Kann Pump und leichte Ausdauervorteile im Training bringen, Evidenz für Kraftsteigerung ist gemischt.",
    rating: "situational",
    dosage: "6-8 g, 30-60 Min. vor dem Training",
  },
  {
    name: "Vitamin D",
    description:
      "Sinnvoll bei nachgewiesenem Mangel (in nördlichen Breiten häufig, v. a. im Winter) — kein direkter Leistungsbooster, aber wichtig für Knochen/Immunsystem.",
    rating: "situational",
    dosage: "Nach Bluttest dosieren, häufig 800-2000 IE täglich bei Mangel",
  },
  {
    name: "Omega-3 (Fischöl)",
    description:
      "Sinnvoll bei geringem Fischkonsum, Effekte auf Entzündungswerte/Herz-Kreislauf-Gesundheit gut belegt, direkter Trainingseffekt ist gering.",
    rating: "situational",
    dosage: "1-2 g EPA/DHA täglich",
  },
  {
    name: "Ashwagandha",
    description:
      "Erste Studien zeigen mögliche Vorteile bei Stress/Cortisol und leicht erhöhter Kraft, Evidenzbasis ist aber deutlich kleiner als bei Kreatin/Koffein.",
    rating: "situational",
    dosage: "300-600 mg Wurzelextrakt täglich",
  },
  {
    name: "BCAA (verzweigtkettige Aminosäuren)",
    description:
      "Bei ausreichender Gesamt-Proteinzufuhr über den Tag praktisch ohne Zusatznutzen — die enthaltenen Aminosäuren stecken bereits in jedem vollständigen Protein.",
    rating: "overrated",
    dosage: "—",
  },
  {
    name: "Pflanzliche Testosteron-Booster (z. B. Tribulus)",
    description:
      "Keine überzeugende Evidenz für einen relevanten Anstieg von freiem Testosteron oder Muskelaufbau bei gesunden Männern.",
    rating: "overrated",
    dosage: "—",
  },
  {
    name: "Fatburner / Fettverbrennungs-Komplexe",
    description:
      "Effekt ist überwiegend das enthaltene Koffein — ein Kaloriendefizit schlägt jedes Supplement in dieser Kategorie deutlich.",
    rating: "overrated",
    dosage: "—",
  },
  {
    name: "Glutamin",
    description:
      "Bei normaler, proteinreicher Ernährung kein nachgewiesener Zusatznutzen für Muskelaufbau oder Erholung bei gesunden, trainierten Personen.",
    rating: "overrated",
    dosage: "—",
  },
];
