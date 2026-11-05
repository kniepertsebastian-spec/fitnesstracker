// Hard server-side exclusion of exercises that load an injured body region. The prompt already
// asks the model to respect limitations, but a model sees only names and primary muscles and
// does not reliably spot e.g. a bench press as "shoulder-intensive" — so exercises that clearly
// stress the region are removed from the catalog before the model ever sees them (anything it
// still returns is dropped by the catalog check in aiPlanGenerator.service.ts).

interface BodyRegion {
  // Matched (case-insensitive substring) against the user's free text.
  triggers: string[];
  // Exercises whose primary muscles include one of these are excluded.
  muscles: string[];
  // Exercises whose English or German name contains one of these are excluded.
  nameKeywords: string[];
}

const REGIONS: BodyRegion[] = [
  {
    triggers: ["schulter", "shoulder", "rotatoren", "impingement"],
    muscles: ["shoulders"],
    // Specific phrases, not bare "press"/"raise" — those would also hit leg press or calf raises.
    nameKeywords: [
      "bench press", "shoulder press", "overhead", "military", "chest press", "incline", "decline",
      "push press", "floor press", "arnold", "dip", "push-up", "push up", "pushup", "fly", "flye",
      "lateral raise", "front raise", "side raise", "rear delt", "upright", "handstand", "snatch",
      "jerk", "clean", "pull-up", "pull up", "chin-up", "muscle-up", "hanging", "bankdrücken",
      "schulterdrücken", "brustpresse", "schrägbank", "militär", "liegestütz", "fliegende",
      "seitheben", "frontheben", "klimmzug", "reißen", "stoßen",
    ],
  },
  {
    triggers: ["knie", "knee", "meniskus"],
    muscles: [],
    nameKeywords: ["squat", "lunge", "jump", "leg extension", "kniebeuge", "ausfallschritt", "sprung", "beinstrecker", "step-up", "step up"],
  },
  {
    triggers: ["rücken", "bandscheibe", "lower back", "ischias"],
    muscles: ["lower back"],
    nameKeywords: ["deadlift", "good morning", "bent over", "hyperextension", "kreuzheben", "rudern vorgebeugt", "snatch", "clean"],
  },
  {
    triggers: ["ellbogen", "elbow", "tennisarm", "golferarm"],
    muscles: ["biceps", "triceps"],
    nameKeywords: ["dip", "skull", "french", "close-grip", "pushdown"],
  },
  {
    triggers: ["handgelenk", "wrist"],
    muscles: ["forearms"],
    nameKeywords: ["push-up", "push up", "pushup", "wrist", "plank", "handstand", "liegestütz", "unterarmstütz"],
  },
  {
    triggers: ["hüfte", "hip "],
    muscles: [],
    nameKeywords: ["hip thrust", "deadlift", "lunge", "squat", "kreuzheben", "ausfallschritt", "kniebeuge"],
  },
];

export interface ExerciseExclusions {
  muscles: string[];
  nameKeywords: string[];
}

// A region word alone ("Schultern priorisieren", "mehr Rücken") is no injury — it only counts
// when a problem word sits close by ("Schulterprobleme", "rechte Schulter schmerzt").
const PROBLEM_WORDS = [
  "problem", "schmerz", "schmerzt", "verletz", "beschwerd", "pain", "injur", "hurt", "op ",
  "entzünd", "schonen", "schonung", "vermeid", "reizung", "gereizt", "impingement", "kaputt",
  "angeschlagen", "einschränk", "weh", "sore", "issue",
];
const PROXIMITY = 40;

function mentionsWithProblem(haystack: string, trigger: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(trigger, from);
    if (at === -1) return false;
    const window = haystack.slice(Math.max(0, at - PROXIMITY), at + trigger.length + PROXIMITY);
    if (PROBLEM_WORDS.some((w) => window.includes(w))) return true;
    from = at + trigger.length;
  }
}

export function buildExclusions(...texts: Array<string | null | undefined>): ExerciseExclusions {
  const haystack = texts.filter(Boolean).join(" \n").toLowerCase();
  const muscles = new Set<string>();
  const nameKeywords = new Set<string>();
  if (haystack.trim()) {
    for (const region of REGIONS) {
      if (!region.triggers.some((t) => mentionsWithProblem(haystack, t))) continue;
      region.muscles.forEach((m) => muscles.add(m));
      region.nameKeywords.forEach((k) => nameKeywords.add(k));
    }
  }
  return { muscles: [...muscles], nameKeywords: [...nameKeywords] };
}

export function isExcluded(
  exercise: { name: string; nameDe?: string | null; primaryMuscles: string[] },
  exclusions: ExerciseExclusions,
): boolean {
  if (exclusions.muscles.some((m) => exercise.primaryMuscles.includes(m))) return true;
  const name = `${exercise.name} ${exercise.nameDe ?? ""}`.toLowerCase();
  return exclusions.nameKeywords.some((k) => name.includes(k));
}
