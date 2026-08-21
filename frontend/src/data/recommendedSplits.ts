// Curated, static split templates — not derived from the exercise catalog or the (still
// disabled) Claude integration, same reasoning as the nutrition tips: a small fixed list is
// honest about being fixed content, where matching against the imported catalog would need
// per-exercise ID resolution this doesn't attempt. Purely informational; adding one of these to
// a phase is still a manual step via "+ Übung".
export interface RecommendedSplitDay {
  label: string;
  exercises: string[];
}

export interface RecommendedSplit {
  id: string;
  title: string;
  description: string;
  days: RecommendedSplitDay[];
}

export const RECOMMENDED_SPLITS: RecommendedSplit[] = [
  {
    id: "push-pull-legs",
    title: "Push/Pull/Legs",
    description: "3er-Split nach Bewegungsrichtung — je Muskelgruppe genug Erholung zwischen den Einheiten.",
    days: [
      {
        label: "Push (Brust, Schultern, Trizeps)",
        exercises: [
          "Bankdrücken (Langhantel)",
          "Schrägbankdrücken (Kurzhantel)",
          "Schulterdrücken (Langhantel)",
          "Seitheben",
          "Dips",
          "Trizepsdrücken am Kabel",
          "Fliegende (Kurzhantel)",
        ],
      },
      {
        label: "Pull (Rücken, Bizeps)",
        exercises: [
          "Klimmzüge",
          "Rudern vorgebeugt (Langhantel)",
          "Latzug",
          "Kabelrudern sitzend",
          "Bizeps-Curl (Langhantel)",
          "Hammer-Curl",
          "Face Pull",
        ],
      },
      {
        label: "Legs (Beine)",
        exercises: [
          "Kniebeuge",
          "Beinpresse",
          "Rumänisches Kreuzheben",
          "Ausfallschritte",
          "Beinstrecker",
          "Beinbeuger",
          "Wadenheben",
        ],
      },
    ],
  },
  {
    id: "whole-body",
    title: "Ganzkörper",
    description: "Eine Einheit für den ganzen Körper — gut für 2-3× Training pro Woche mit Ruhetagen dazwischen.",
    days: [
      {
        label: "Ganzkörper",
        exercises: [
          "Kniebeuge",
          "Bankdrücken (Langhantel)",
          "Rudern vorgebeugt (Langhantel)",
          "Schulterdrücken (Langhantel)",
          "Latzug",
          "Rumänisches Kreuzheben",
          "Bizeps-Curl oder Trizepsdrücken am Kabel",
        ],
      },
    ],
  },
  {
    id: "upper-lower",
    title: "Oberkörper/Unterkörper",
    description: "2er-Split — jede Körperhälfte zweimal pro Woche, mehr Volumen pro Muskelgruppe als Ganzkörper.",
    days: [
      {
        label: "Oberkörper",
        exercises: [
          "Bankdrücken (Langhantel)",
          "Rudern vorgebeugt (Langhantel)",
          "Schulterdrücken (Langhantel)",
          "Klimmzüge oder Latzug",
          "Bizeps-Curl (Langhantel)",
          "Trizepsdrücken am Kabel",
          "Seitheben",
        ],
      },
      {
        label: "Unterkörper",
        exercises: [
          "Kniebeuge",
          "Rumänisches Kreuzheben",
          "Beinpresse",
          "Ausfallschritte",
          "Beinstrecker",
          "Beinbeuger",
          "Wadenheben",
        ],
      },
    ],
  },
  {
    id: "arnold-split",
    title: "Arnold Split",
    description:
      "3er-Split nach Arnold Schwarzeneggers klassischem Schema: Brust+Rücken, Schultern+Arme, Beine.",
    days: [
      {
        label: "Brust & Rücken",
        exercises: [
          "Bankdrücken (Langhantel)",
          "Klimmzüge",
          "Schrägbankdrücken (Kurzhantel)",
          "Rudern vorgebeugt (Langhantel)",
          "Fliegende (Kurzhantel)",
          "Latzug",
          "Dips",
        ],
      },
      {
        label: "Schultern & Arme",
        exercises: [
          "Schulterdrücken (Langhantel)",
          "Seitheben",
          "Bizeps-Curl (Langhantel)",
          "Trizepsdrücken am Kabel",
          "Hammer-Curl",
          "Face Pull",
          "French Press",
        ],
      },
      {
        label: "Beine",
        exercises: [
          "Kniebeuge",
          "Rumänisches Kreuzheben",
          "Beinpresse",
          "Ausfallschritte",
          "Beinstrecker",
          "Beinbeuger",
          "Wadenheben",
        ],
      },
    ],
  },
];
