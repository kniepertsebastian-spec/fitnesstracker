// The exercise catalog stores muscles, equipment and categories as English keys (free-exercise-db).
// The database values stay untouched — they are filter keys — and are translated only for display.
const MUSCLES: Record<string, string> = {
  abdominals: "Bauch",
  abductors: "Abduktoren",
  adductors: "Adduktoren",
  biceps: "Bizeps",
  calves: "Waden",
  chest: "Brust",
  forearms: "Unterarme",
  glutes: "Gesäß",
  hamstrings: "Beinbeuger",
  lats: "Latissimus",
  "lower back": "Unterer Rücken",
  "middle back": "Mittlerer Rücken",
  neck: "Nacken",
  quadriceps: "Quadrizeps",
  shoulders: "Schultern",
  traps: "Trapez",
  triceps: "Trizeps",
};

const EQUIPMENT: Record<string, string> = {
  "body only": "Körpergewicht",
  machine: "Maschine",
  other: "Sonstiges",
  "foam roll": "Faszienrolle",
  kettlebells: "Kettlebell",
  dumbbell: "Kurzhantel",
  cable: "Kabelzug",
  barbell: "Langhantel",
  bands: "Widerstandsband",
  "medicine ball": "Medizinball",
  "exercise ball": "Gymnastikball",
  "e-z curl bar": "SZ-Stange",
};

const CATEGORIES: Record<string, string> = {
  strength: "Kraft",
  stretching: "Dehnen",
  plyometrics: "Plyometrie",
  powerlifting: "Kraftdreikampf",
  strongman: "Strongman",
  cardio: "Cardio",
  "olympic weightlifting": "Gewichtheben",
};

function label(table: Record<string, string>, value: string): string {
  return table[value.trim().toLowerCase()] ?? value;
}

export const muscleLabel = (value: string) => label(MUSCLES, value);
export const equipmentLabel = (value: string) => label(EQUIPMENT, value);
export const categoryLabel = (value: string) => label(CATEGORIES, value);
