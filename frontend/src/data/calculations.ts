// Every figure the app calculates, with the formula as implemented, the inputs it uses and where
// the method comes from. This file is the single source for the "Berechnungen & Quellen" card in
// the settings and for the (i) buttons next to the figures — when a formula in the code changes,
// change its entry here too (the file names in `code` point at the implementation).

// How solid the origin of a method is, so a reader can tell a published formula from a rule of
// thumb or an assumption made for this app:
//  - literatur: published formula or research result
//  - richtwert: common rule of thumb in practice, no single study
//  - annahme:   the app's own assumption or rule
export type CalculationBasis = "literatur" | "richtwert" | "annahme";

export const BASIS_LABELS: Record<CalculationBasis, string> = {
  literatur: "Aus der Literatur",
  richtwert: "Gängiger Richtwert",
  annahme: "Eigene Annahme der App",
};

export type CalculationGroup = "ernaehrung" | "training" | "plan" | "begriffe";

export const GROUP_LABELS: Record<CalculationGroup, string> = {
  ernaehrung: "Ernährung & Körper",
  training: "Training & Auswertung",
  plan: "Pläne & Vorschläge",
  begriffe: "Begriffe",
};

export interface CalculationInfo {
  id: string;
  group: CalculationGroup;
  title: string;
  /** Where in the app the figure appears. */
  shows: string;
  /** The formula or rule, one step per line. */
  formula: string[];
  /** What goes in. */
  inputs?: string;
  basis: CalculationBasis;
  /** Origin, as citations or a plain statement. */
  sources: string[];
  note?: string;
  /** Implementation, for anyone who wants to check the code. */
  code?: string;
}

export const CALCULATIONS: CalculationInfo[] = [
  // --- Ernährung & Körper -------------------------------------------------------------------
  {
    id: "bmr",
    group: "ernaehrung",
    title: "Grundumsatz (BMR)",
    shows: "Ernährung → Profil: „Grundumsatz (BMR)“; auch Basis der Kalorien-Schätzung beim Krafttraining.",
    formula: [
      "Männer: BMR = 10 × Gewicht (kg) + 6,25 × Größe (cm) − 5 × Alter (Jahre) + 5",
      "Frauen: BMR = 10 × Gewicht (kg) + 6,25 × Größe (cm) − 5 × Alter (Jahre) − 161",
    ],
    inputs: "Profil: Gewicht, Größe, Alter, Geschlecht. Ergebnis in kcal pro Tag, gerundet.",
    basis: "literatur",
    sources: [
      "Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO: A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 1990; 51(2): 241–247 (Mifflin-St-Jeor-Gleichung).",
    ],
    note: "Eine Schätzung für gesunde Erwachsene. Der tatsächliche Ruheumsatz kann um etwa 10 % oder mehr abweichen.",
    code: "backend/src/modules/profile/profile.service.ts",
  },
  {
    id: "tdee",
    group: "ernaehrung",
    title: "Gesamtumsatz (TDEE)",
    shows: "Ernährung → Profil: „Gesamtumsatz (TDEE)“.",
    formula: [
      "TDEE = BMR × Aktivitätsfaktor",
      "Kaum Bewegung 1,2 · Leicht aktiv 1,375 · Mäßig aktiv 1,55 · Sehr aktiv 1,725 · Extrem aktiv 1,9",
    ],
    inputs: "BMR (siehe oben) und das gewählte Aktivitätslevel im Profil.",
    basis: "richtwert",
    sources: [
      "Die fünf Faktoren sind die in der Ernährungspraxis üblichen Aktivitätsfaktoren (aus der Tradition der Harris-Benedict-Rechner). Sie stammen nicht aus einer einzelnen Studie.",
    ],
    note: "Das Aktivitätslevel ist eine Selbsteinschätzung und der größte Unsicherheitsfaktor. Im Zweifel das niedrigere wählen und nach 2–3 Wochen am Gewichtsverlauf prüfen.",
    code: "backend/src/modules/profile/profile.service.ts",
  },
  {
    id: "target-kcal",
    group: "ernaehrung",
    title: "Ziel-Kalorien und Defizit",
    shows: "Ernährung → Profil: „Ziel-Kalorien“.",
    formula: [
      "Ziel-Kalorien = TDEE + Anpassung",
      "Abnehmen: −500 kcal · Halten: ±0 · Aufbauen: +300 kcal",
      "Orientierung zum Defizit: 500 kcal × 7 Tage = 3.500 kcal pro Woche ≈ 0,45 kg Körpergewicht pro Woche (bei 7.700 kcal je kg Körpergewicht)",
    ],
    inputs: "TDEE und das Ernährungsziel im Profil.",
    basis: "richtwert",
    sources: [
      "Die Umrechnung „ca. 7.700 kcal je kg“ geht auf Wishnofsky zurück: Wishnofsky M: Caloric equivalents of gained or lost weight. Am J Clin Nutr 1958; 6(5): 542–546.",
      "Die Regel gilt als grobe Vereinfachung, weil sich der Umsatz beim Abnehmen mit anpasst: Hall KD et al.: Quantification of the effect of energy imbalance on bodyweight. Lancet 2011; 378: 826–837.",
      "Die Werte −500 / +300 kcal sind die gängige Praxis für ein moderates Defizit bzw. einen schlanken Überschuss, die App legt sie fest (kein „Profi-Tarif“ mit mehr).",
    ],
    note: "Ein mäßiges Defizit schützt Muskelmasse und Energie; ein größeres bringt vor allem mehr Muskelverlust.",
    code: "backend/src/modules/profile/profile.service.ts",
  },
  {
    id: "protein",
    group: "ernaehrung",
    title: "Ziel-Protein",
    shows: "Ernährung → Profil: „Ziel-Protein“.",
    formula: [
      "Ziel-Protein (g) = Körpergewicht (kg) × Faktor",
      "Abnehmen 2,2 g/kg · Halten 1,8 g/kg · Aufbauen 1,6 g/kg",
    ],
    inputs: "Profil: Gewicht und Ernährungsziel.",
    basis: "richtwert",
    sources: [
      "Orientierung an den Empfehlungen für Trainierende: Jäger R et al.: International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr 2017; 14: 20 (ca. 1,4–2,0 g/kg täglich).",
      "Im Defizit werden höhere Mengen empfohlen, um Muskelmasse zu schützen: Helms ER, Aragon AA, Fitschen PJ: Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 2014; 11: 20.",
      "Die drei konkreten Zahlen (2,2 / 1,8 / 1,6) wählt die App innerhalb dieser Spannen; die offizielle Mindestzufuhr (RDA) liegt bei 0,8 g/kg.",
    ],
    code: "backend/src/modules/profile/profile.service.ts",
  },
  {
    id: "fat-loss-target",
    group: "ernaehrung",
    title: "Zielgewicht bei Ziel-Körperfett",
    shows: "Ernährung → „Dein Abnehmziel & Muskelerhalt“.",
    formula: [
      "Fettmasse = Gewicht × Körperfett % ÷ 100",
      "Fettfreie Masse = Gewicht − Fettmasse",
      "Zielgewicht = Fettfreie Masse ÷ (1 − Ziel-Körperfett % ÷ 100)",
      "Möglicher Fettverlust = Fettmasse − Zielgewicht × Ziel-Körperfett % ÷ 100",
    ],
    inputs: "Letzte Körpermessung (Gewicht, Körperfett %) und dein Ziel-Körperfett.",
    basis: "annahme",
    sources: [
      "Reines Rechenmodell mit der Annahme, dass die fettfreie Masse gleich bleibt (der Verlust also nur aus Fett besteht). Es gibt dafür keine Quelle, es ist eine Umstellung der Definition von Körperfett %.",
    ],
    note: "Fettfreie Masse ist nicht dasselbe wie Muskelmasse, und Körperfettwaagen (Bioimpedanz) schwanken mit Flüssigkeit und Tageszeit. Das Ergebnis ist eine Orientierung.",
    code: "frontend/src/components/nutrition/FatLossGoalCard.tsx",
  },
  {
    id: "body-fat-category",
    group: "ernaehrung",
    title: "Körperfett-Einordnung",
    shows: "Ernährung → Körperdaten: Zeile unter dem Körperfett-Wert.",
    formula: [
      "Männer: bis 5 % essentiell · bis 13 % athletisch · bis 17 % fit · bis 24 % durchschnittlich · darüber erhöht",
      "Frauen: bis 13 % essentiell · bis 20 % athletisch · bis 24 % fit · bis 31 % durchschnittlich · darüber erhöht",
    ],
    inputs: "Körperfett % der letzten Messung und das Geschlecht aus dem Profil. Ohne Profil entfällt die Einordnung.",
    basis: "richtwert",
    sources: ["Kategorien des American Council on Exercise (ACE) für den Körperfettanteil. Keine medizinische Bewertung."],
    code: "frontend/src/data/bodyMetricsInfo.ts",
  },
  {
    id: "weight-mean",
    group: "ernaehrung",
    title: "Gleitendes 7-Tage-Mittel des Körpergewichts",
    shows: "Dashboard: Karte „Körpergewicht“.",
    formula: [
      "Mittel = Durchschnitt aller Gewichtsmessungen der letzten 7 Tage",
      "Veränderung zur Vorwoche = Mittel (letzte 7 Tage) − Mittel (die 7 Tage davor)",
    ],
    inputs: "Alle Körpermessungen mit Datum. Gibt es in einem Zeitraum keine Messung, entfällt der Wert.",
    basis: "richtwert",
    sources: [
      "Mittelwertbildung glättet die täglichen Schwankungen durch Wasser und Mahlzeiten, deshalb sagt der Trend mehr als ein einzelner Wert.",
    ],
    code: "frontend/src/lib/stats.ts (meanWeight)",
  },

  // --- Training & Auswertung ----------------------------------------------------------------
  {
    id: "kcal-lifting",
    group: "training",
    title: "Verbrauchte Kalorien beim Krafttraining (Schätzung)",
    shows: "Training (unter den Sätzen und auf der Abschluss-Seite), Tagebuch („Gesamt heute“) und Historie (pro Übung und Tag).",
    formula: [
      "Pro Satz: kcal = Arbeit ÷ 4.184 + Aktivierung",
      "Arbeit (Joule) = Last × 9,81 × Bewegungsweg × Wdh. × 1,33 ÷ 0,22",
      "Bewegungsweg = Körpergröße (m) × 0,25",
      "Aktivierung = 3 × (BMR ÷ 24) × (Wdh. × 3 s ÷ 3600)",
      "Last = eingetragenes Gewicht; bei 0 kg (Körpergewicht): 60 % deines Körpergewichts",
      "Pro Übung / Tag: Summe aller Sätze",
    ],
    inputs: "Je Satz Gewicht und Wiederholungen; aus dem Profil Größe, Alter, Geschlecht; Gewicht der letzten Körpermessung (sonst Profilgewicht).",
    basis: "annahme",
    sources: [
      "Teil 1, mechanische Arbeit: Last × Erdbeschleunigung × Weg ist die Physik der Hubarbeit. Der Wirkungsgrad der Muskeln von etwa 20–25 % ist ein üblicher Wert der Arbeitsphysiologie (z. B. Gaesser GA, Brooks GA: Muscular efficiency during steady-rate exercise. J Appl Physiol 1975; 38(6): 1132–1139); die App rechnet mit 22 %.",
      "Teil 2, Aktivierung: Das MET-Konzept (1 MET = Ruheumsatz) stammt aus dem Compendium of Physical Activities (Ainsworth BE et al.: 2011 Compendium of Physical Activities. Med Sci Sports Exerc 2011; 43(8): 1575–1581). Der Ruheumsatz kommt aus Mifflin-St Jeor (siehe Grundumsatz).",
      "Eigene Annahmen der App: Senken kostet etwa ein Drittel der Hebearbeit (Faktor 1,33); Bewegungsweg = 25 % der Körpergröße; 3 Sekunden je Wiederholung; 3 MET über Ruhe für die Muskelspannung; 60 % des Körpergewichts bei Körpergewichtsübungen.",
    ],
    note: "Ein Schätzwert, der typisch um ±30–50 % abweichen kann. Nicht eingerechnet sind Satzpausen, Aufwärmen, Cardio und der Nachbrenneffekt, das Ergebnis liegt daher deutlich unter dem Gesamtverbrauch einer Trainingseinheit.",
    code: "frontend/src/lib/calories.ts",
  },
  {
    id: "one-rep-max",
    group: "training",
    title: "Geschätztes 1RM",
    shows: "Tagebuch („≈ 1RM“ unter dem Satz), Fortschritt (Kraftverlauf) und Rekord-Erkennung.",
    formula: [
      "Epley: 1RM = Gewicht × (1 + Wdh. ÷ 30)",
      "Brzycki: 1RM = Gewicht × 36 ÷ (37 − Wdh.)",
      "Angezeigt wird der Mittelwert beider Formeln; bei 1 Wdh. das Gewicht selbst; ab 37 Wdh. nur Epley",
    ],
    inputs: "Gewicht und Wiederholungen eines Satzes. Ohne Gewicht (0 kg) gibt es keinen Wert.",
    basis: "literatur",
    sources: [
      "Epley B: Poundage chart. Boyd Epley Workout. Lincoln (NE): Body Enterprises, 1985.",
      "Brzycki M: Strength testing – predicting a one-rep max from reps-to-fatigue. JOPERD 1993; 64(1): 88–90.",
    ],
    note: "Beide Formeln sind für niedrige Wiederholungszahlen (etwa 2–10) am zuverlässigsten und weichen bei vielen Wiederholungen stark voneinander ab.",
    code: "frontend/src/lib/oneRepMax.ts",
  },
  {
    id: "records",
    group: "training",
    title: "Rekorde",
    shows: "Meldung „Neuer Rekord“ beim Speichern eines Satzes, Zähler „Rekorde“ im Dashboard, Fortschritt und auf der Abschluss-Seite.",
    formula: [
      "Gewicht: dein schwerster Satz dieser Übung ist schwerer als jeder frühere",
      "Wiederholungen: die meisten Wiederholungen in einem Satz dieser Übung übertreffen jeden früheren Satz",
      "Geschätztes 1RM: das geschätzte 1RM (siehe dort) ist höher als bei jedem früheren Satz",
      "Tagesvolumen: die Summe aus Gewicht × Wdh. des Tages überholt erstmals den besten früheren Tag",
    ],
    inputs: "Alle früheren Sätze derselben Übung. Das allererste Mal einer Übung zählt nie als Rekord (es gibt nichts zu übertreffen). Aufwärmsätze werden nicht protokolliert und zählen daher nicht.",
    basis: "annahme",
    sources: ["Regeln der App. Zusätzlich meldet der Server per Push nur Gewichts- und Wiederholungsrekorde."],
    code: "frontend/src/lib/prDetection.ts",
  },
  {
    id: "volume",
    group: "training",
    title: "Trainingsvolumen",
    shows: "Dashboard, Fortschritt (Volumen, Vergleich zum Vorzeitraum) und Abschluss-Seite.",
    formula: [
      "Volumen = Summe aus Gewicht (kg) × Wiederholungen über alle Sätze",
      "Vergleich zum Vorzeitraum = (Volumen − Volumen des Vorzeitraums) ÷ Volumen des Vorzeitraums × 100 %",
    ],
    inputs: "Alle protokollierten Sätze im Zeitraum. Körpergewichtsübungen mit 0 kg tragen 0 bei.",
    basis: "richtwert",
    sources: ["Übliche Definition des „Volume Load“ im Krafttraining."],
    code: "frontend/src/lib/stats.ts",
  },
  {
    id: "progression",
    group: "training",
    title: "Gewicht erhöhen oder verringern (Progressionsvorschlag)",
    shows: "Training: Zeile „Heute: 82,5 kg × 8 (+2,5)“ über der Satzeingabe und „Vorschlag“ in der Übungsübersicht.",
    formula: [
      "Basis: die letzten zwei protokollierten Sätze der Übung; Ziel-Wdh. = Wert aus dem Plan, sonst Aufbau 10 · Muskelausdauer 20 · Negativ 5",
      "Aufbau und Negativ („Gewicht“-Modus):",
      "  Ziel-Wdh. im letzten Satz erreicht → Gewicht + 2,5 kg",
      "  Ziel nicht erreicht → gleiches Gewicht nochmal",
      "Muskelausdauer („Wiederholungen“-Modus):",
      "  Ziel erreicht → Wiederholungen + 2 bei gleichem Gewicht",
      "  Ziel nicht erreicht → Ziel-Wdh. bleiben",
      "Deload: beide letzten Sätze mit demselben Gewicht unter dem Ziel → Gewicht × 0,9, gerundet auf 2,5 kg (Vorschlag „Deload“)",
    ],
    inputs: "Letzte zwei Sätze der Übung (Gewicht, Wiederholungen), Trainingsphase und Ziel-Wdh.",
    basis: "richtwert",
    sources: [
      "Die Regel folgt dem gängigen Prinzip der linearen bzw. doppelten Progression (erst Wiederholungen im Zielbereich schaffen, dann das Gewicht erhöhen) mit einer Entlastung nach zwei Fehlversuchen. Die Schrittweite von 2,5 kg und die 10 % sind Festlegungen der App.",
    ],
    note: "Es ist ein Vorschlag. Du kannst jederzeit ein anderes Gewicht wählen; die Schrittweite im Training (2,5 oder 5 kg) betrifft nur die Bedienung der Plus-/Minus-Tasten.",
    code: "backend/src/modules/trainingPlan/planWeekStatus.service.ts",
  },
  {
    id: "warmup",
    group: "training",
    title: "Aufwärmsätze",
    shows: "Training: Block „Aufwärmen“ vor dem ersten Arbeitssatz.",
    formula: [
      "Gewicht = Arbeitsgewicht × Prozent, gerundet auf 2,5 kg: 40 % × 8 Wdh. · 60 % × 5 Wdh. · 80 % × 3 Wdh.",
      "Mindestens die Stange (20 kg bei Langhantel); doppelte Stufen oder solche ab Arbeitsgewicht entfallen; unter 25 kg Arbeitsgewicht gibt es keine",
    ],
    inputs: "Das Gewicht, das du für den ersten Arbeitssatz eingestellt hast.",
    basis: "richtwert",
    sources: ["Gängige Praxis (Steigerung in Prozent des Arbeitsgewichts), keine Studie. Aufwärmsätze werden nicht gespeichert und zählen nicht zu Volumen, Rekorden oder Progression."],
    code: "frontend/src/lib/warmup.ts",
  },
  {
    id: "plates",
    group: "training",
    title: "Plattenrechner",
    shows: "Training: Zeile „Pro Seite“ bei Langhantel-Übungen.",
    formula: [
      "Pro Seite = (Gesamtgewicht − 20 kg Stange) ÷ 2",
      "Scheiben der Reihe nach vom schwersten: 25, 20, 15, 10, 5, 2,5, 1,25 kg, solange sie noch passen",
    ],
    inputs: "Eingestelltes Gewicht. Ein Rest, der nicht mit diesen Scheiben aufgeht, wird angezeigt.",
    basis: "richtwert",
    sources: ["Übliche Hantelscheiben und die Standardstange von 20 kg. Hat deine Stange ein anderes Gewicht, weicht das Ergebnis ab."],
    code: "frontend/src/lib/plates.ts",
  },
  {
    id: "muscle-volume",
    group: "training",
    title: "Sätze pro Muskelgruppe und Woche",
    shows: "Fortschritt: Karte „Sätze pro Muskel“.",
    formula: [
      "Für jede Woche (Montag bis Sonntag): Anzahl Sätze je Hauptmuskel der Übung",
      "Ø = Summe der letzten 4 Wochen ÷ 4; Strich bei 10 Sätzen",
    ],
    inputs: "Protokollierte Sätze und der Hauptmuskel der jeweiligen Übung. Nebenmuskeln zählen nicht mit (sonst würde jede Grundübung doppelt zählen).",
    basis: "richtwert",
    sources: [
      "Die Orientierung von etwa 10–20 Sätzen pro Muskel und Woche für Muskelaufbau beruht auf Schoenfeld BJ, Ogborn D, Krieger JW: Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 2017; 35(11): 1073–1082 (mehr Wochenvolumen war bis zu etwa dieser Größenordnung mit mehr Muskelzuwachs verbunden).",
    ],
    note: "Der Richtwert ist keine Vorgabe. Wie viel sinnvoll ist, hängt von Erfahrung, Erholung und Ziel ab.",
    code: "backend/src/modules/workoutLogs/muscleVolume.ts",
  },
  {
    id: "streak",
    group: "training",
    title: "Serie und Trainingskalender",
    shows: "Dashboard: „Diese Woche“ und Trainingskalender; Fortschritt: „Serie (längste)“.",
    formula: [
      "Serie = aufeinanderfolgende Wochen (Mo–So) mit mindestens einem Trainingstag; zählt ab der aktuellen Woche, solange diese noch leer ist ab der Vorwoche",
      "Kalender: ein Quadrat pro Tag der letzten 12 Wochen; Farbe nach Tagesvolumen im Verhältnis zum stärksten Tag: über 66 % dunkel · über 33 % mittel · darunter hell · kein Training leer",
    ],
    inputs: "Datum und Volumen aller protokollierten Sätze.",
    basis: "annahme",
    sources: ["Regeln der App. Die Serie zählt bewusst in Wochen, weil Krafttraining Ruhetage braucht."],
    code: "frontend/src/lib/stats.ts",
  },

  // --- Pläne & Vorschläge -------------------------------------------------------------------
  {
    id: "plateau",
    group: "plan",
    title: "Plateau-Erkennung",
    shows: "Ziel-Vorschläge („Plateau“) und beim Erstellen eines KI-Plans (stagnierende Übungen werden ersetzt).",
    formula: [
      "Betrachtet werden die letzten 90 Tage einer Übung (mindestens 4 Einträge; ab durchschnittlich 15 Wdh. zählen die Wiederholungen, sonst das Gewicht)",
      "Plateau, wenn der beste Wert der letzten 3 Einträge nicht über dem besten Wert davor liegt",
      "Kein Plateau, wenn das Volumen in der zweiten Hälfte unter 50 % der ersten fällt (das gilt als Deload oder aufgegebene Übung)",
      "Fortschritt → „Kraft und Rekorde“: dieselbe Regel, aber mit einem Wert je Trainingstag (geschätztes 1RM des besten Satzes) und mindestens 4 Trainingstagen",
    ],
    inputs: "Protokollierte Sätze der letzten 90 Tage.",
    basis: "annahme",
    sources: ["Einfache Regel der App, keine Studie. Ein Plateau kann auch ein schlechter Zeitraum (Schlaf, Stress, Krankheit) sein."],
    code: "backend/src/modules/goals/goalSuggestion.service.ts",
  },
  {
    id: "goal-suggestion",
    group: "plan",
    title: "Ziel-Vorschläge",
    shows: "Ziele: Karte „Vorschläge“ mit den drei Stufen Konservativ, Realistisch, Ambitioniert.",
    formula: [
      "Ausgangswert = Bestwert (Gewicht oder, ab durchschnittlich 15 Wdh., Wiederholungen)",
      "Zuwachs (Gewicht): 3 % / 5 % / 8 % des Bestwerts, auf 0,5 kg gerundet (mindestens 0,5 / 1 / 1,5 kg)",
      "Zuwachs (Wiederholungen): +2 / +3 / +5",
      "Bei Plateau werden die Zuwächse mit 0,6 skaliert",
      "Tempo = bisherige Zunahme pro Woche (Bestwert jetzt − frühester Bestwert) ÷ Wochen, mindestens 0,1 kg bzw. 0,15 Wdh. pro Woche; bei Plateau gilt dieser Mindestwert",
      "Datum = heute + Zuwachs ÷ (Tempo × 0,7 / 1 / 1,3), aufgerundet auf ganze Wochen und mindestens so viele Wochen, wie die Trainingsabstände nötig machen",
      "Zielfaktor (ab 3 erreichten Zielen mit Zieldatum): waren ≥ 70 % davon pünktlich, Tempo × 1,15; bei < 40 % × 0,85",
    ],
    inputs: "Sätze der letzten 90 Tage (mindestens 3), deine früheren Ziele mit Zieldatum und Erreichung.",
    basis: "annahme",
    sources: ["Regeln der App, keine Studie."],
    code: "backend/src/modules/goals/goalSuggestion.service.ts",
  },
  {
    id: "start-weight",
    group: "plan",
    title: "Startgewicht im KI-Plan",
    shows: "Vorschau des KI-Trainingsplans: „Startgewicht“ je Übung.",
    formula: [
      "Bestes geschätztes 1RM (Epley) der letzten 8 Wochen: Gewicht × (1 + Wdh. ÷ 30), nur Sätze bis 30 Wdh.",
      "Startgewicht = 1RM ÷ (1 + (Ziel-Wdh. + RIR) ÷ 30), abgerundet auf 2,5 kg",
    ],
    inputs: "Protokollierte Sätze der Übung; Ziel-Wdh. und RIR aus dem Plan. Ohne Satz mit Gewicht gibt es keinen Vorschlag.",
    basis: "literatur",
    sources: ["Epley-Formel (siehe „Geschätztes 1RM“), nach dem Gewicht umgestellt, das noch RIR Wiederholungen übrig lässt."],
    code: "backend/src/modules/aiPlanGenerator/planAssembly.ts",
  },
  {
    id: "phases",
    group: "plan",
    title: "Trainingsphasen und Rotation",
    shows: "Plan: Phase und Woche („Aufbau · W3“) sowie die Vorgaben je Übung.",
    formula: [
      "Die Phase wechselt alle 8 Wochen (verlängerbar mit „+1 Woche“, bis zu 8 Wochen): Aufbau → Muskelausdauer → Negativ → …",
      "Aufbau: 3 Sätze × 8–12 Wdh. · RIR 2 · 120 s Pause",
      "Muskelausdauer: 3 Sätze × 15–20 Wdh. · RIR 2 · 60 s Pause",
      "Negativ: 4 Sätze × 4–6 Wdh. · RIR 2 · 180 s Pause, 3–4 s langsames Absenken",
    ],
    inputs: "Startdatum der Phase und Verlängerungen. Die Werte je Phase sind Vorgaben, die der KI-Generator und der Server als Standard nutzen.",
    basis: "annahme",
    sources: ["Periodisierung in Blöcken ist gängige Trainingspraxis. Die konkreten Satz- und Wiederholungszahlen sind Vorgaben der App."],
    code: "backend/src/modules/aiPlanGenerator/promptBuilder.ts",
  },
  {
    id: "asymmetry",
    group: "plan",
    title: "Erkennung von Ungleichgewichten",
    shows: "Plan → Bemerkungen („Automatisch erkannte Trainingsasymmetrie“) und im KI-Plan.",
    formula: [
      "Gezählt werden die Sätze der letzten 8 Wochen je Hauptmuskel",
      "Paare: Brust ↔ Rücken (Latissimus, mittlerer Rücken), Quadrizeps ↔ Beinbeuger, Bauch ↔ unterer Rücken",
      "Auffällig, wenn ein Paar zusammen mindestens 8 Sätze hat und eine Seite mindestens doppelt so viele Sätze wie die andere",
    ],
    inputs: "Protokollierte Sätze der letzten 8 Wochen.",
    basis: "annahme",
    sources: ["Einfache Faustregel (Verhältnis 2 : 1), keine Studie. Der Hinweis fließt als Wunsch in die KI-Planung ein."],
    code: "backend/src/modules/trainingPlan/trainingAsymmetry.service.ts",
  },
  {
    id: "cardio-rules",
    group: "plan",
    title: "Cardio-Vorschlag",
    shows: "Plan → Cardio je Trainingstag und an freien Tagen; Training (Aufwärmen und Cardio).",
    formula: [
      "Nach Hauptziel, davor 5–8 Min. Aufwärmen, danach Minuten je Ziel (in der Muskelausdauer-Phase +5 Min. danach bei den Zielen Muskelaufbau, Fettabbau und Ausdauer):",
      "Muskelaufbau: 5 / 15 Min. · Kraft: 5 / 10 Min. · Fettabbau: 5 / 25 Min. + Intervalle an einem freien Tag",
      "Ausdauer: 8 / 20 Min. + zwei Einheiten an freien Tagen · Allgemeine Fitness: 5 / 20 Min. + eine freie Einheit",
      "Beintag (mindestens 2 der 3 meisttrainierten Muskeln sind Beinmuskeln): Rad zum Aufwärmen und flaches Gehen danach, damit die Beine nicht erneut belastet werden",
    ],
    inputs: "Trainingsziel, Phase und die Muskeln des Trainingstags. Ohne Trainingsziel gibt es keinen Vorschlag.",
    basis: "richtwert",
    sources: ["Allgemeine Richtwerte für Freizeitsport, keine medizinische Beratung. Jeder Tag lässt sich im Plan überschreiben."],
    code: "backend/src/modules/cardioPlan/cardioSuggestion.ts",
  },
  {
    id: "health-import",
    group: "plan",
    title: "Importierte Gesundheitsdaten",
    shows: "Einstellungen → „Gesundheitsdaten importieren“.",
    formula: [
      "Apple Health: Körpergewicht (BodyMass) in kg, bei Pfund × 0,45359237; Körperfett (BodyFatPercentage) als Anteil × 100",
      "Samsung Health, Google, CSV: Datums-, Gewichts- und Körperfettspalte werden am Spaltennamen erkannt; Werte unter 20 kg oder über 400 kg werden verworfen",
      "Messungen zum selben Zeitpunkt werden nicht doppelt gespeichert",
    ],
    inputs: "Die Export-Datei, die du auswählst. Sie wird im Browser gelesen, gesendet wird erst nach deiner Bestätigung.",
    basis: "annahme",
    sources: ["Umrechnungen und Plausibilitätsgrenzen der App. Das Pfund-Kilogramm-Verhältnis ist die internationale Definition."],
    code: "frontend/src/lib/healthImport.ts",
  },

  // --- Begriffe -----------------------------------------------------------------------------
  {
    id: "term-rir",
    group: "begriffe",
    title: "RIR – Wiederholungen in Reserve",
    shows: "Training und Tagebuch („RIR“), Plan („RIR 2“).",
    formula: [
      "RIR = Anzahl der Wiederholungen, die du am Satzende noch hättest schaffen können",
      "0 = bis zum Muskelversagen · 1 = eine hätte noch geklappt · 2 = zwei hätten noch geklappt …",
    ],
    basis: "literatur",
    sources: [
      "Zourdos MC et al.: Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res 2016; 30(1): 267–275.",
    ],
    note: "Im Plan steht RIR als Ziel („RIR 2“: etwa zwei Wiederholungen Reserve). Beim Speichern eines Satzes wählst du den tatsächlichen Wert (0–4).",
  },
  {
    id: "term-1rm",
    group: "begriffe",
    title: "1RM und „RM“ – Wiederholungsmaximum",
    shows: "Tagebuch und Fortschritt („≈ 1RM“), bei den Rekorden als „Geschätztes 1RM“.",
    formula: [
      "1RM (One-Repetition Maximum) = das Gewicht, das du genau einmal bewältigen könntest",
      "Das 1RM wird hier nicht getestet, sondern aus Gewicht und Wiederholungen eines Satzes geschätzt (Formel siehe „Geschätztes 1RM“)",
    ],
    basis: "literatur",
    sources: ["Allgemeiner Begriff der Krafttrainingslehre."],
  },
  {
    id: "term-pr",
    group: "begriffe",
    title: "PR / Rekord",
    shows: "Meldung „Neuer Rekord“.",
    formula: [
      "PR = Personal Record, also eine persönliche Bestleistung",
      "Welche Arten es gibt (Gewicht, Wiederholungen, geschätztes 1RM, Tagesvolumen) steht unter „Rekorde“",
    ],
    basis: "literatur",
    sources: ["Allgemeiner Begriff."],
  },
  {
    id: "term-deload",
    group: "begriffe",
    title: "Deload",
    shows: "Training: Hinweis „Deload“ beim Vorschlag.",
    formula: [
      "Deload = bewusst leichteres Training zur Erholung",
      "Die App schlägt es vor, wenn du ein Gewicht zweimal hintereinander nicht im Zielbereich geschafft hast (Gewicht × 0,9)",
    ],
    basis: "richtwert",
    sources: ["Allgemeiner Begriff der Trainingslehre; Auslöser siehe „Progressionsvorschlag“."],
  },
  {
    id: "term-met",
    group: "begriffe",
    title: "MET",
    shows: "Kalorien-Schätzung beim Krafttraining.",
    formula: [
      "1 MET = Energieverbrauch in Ruhe (grob 1 kcal je kg Körpergewicht und Stunde)",
      "3 MET über Ruhe bedeutet: die Muskelspannung kostet dreimal so viel wie Ruhe, zusätzlich zum Ruheumsatz",
    ],
    basis: "literatur",
    sources: ["Ainsworth BE et al.: 2011 Compendium of Physical Activities. Med Sci Sports Exerc 2011; 43(8): 1575–1581."],
  },
];

export function getCalculation(id: string): CalculationInfo | undefined {
  return CALCULATIONS.find((c) => c.id === id);
}
