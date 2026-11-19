// Hard server-side exclusion of exercises the user explicitly does not want ("kein Handstand",
// "ohne Burpees"). The prompt alone is not enough: models regularly ignore such wishes, so the
// matching exercises are removed from the catalog before the model sees it — anything it still
// returns is dropped by the catalog check in aiPlanGenerator.service.ts.

// One avoided term: every word must occur in the exercise name, each word through any of its
// alternatives. "Handstand Liegestütze" → [["handstand"], ["pushup", "liegestutz"]], so only
// handstand push-ups go, not every push-up.
export type AvoidMatcher = string[][];

// Letters only, umlauts folded: "Push-Ups", "push ups" and "pushups" all become "pushups".
export function compact(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z]/g, "");
}

// German words a user types → the name fragments they stand for in the (mostly English)
// exercise catalog. Keys and values are in compact() form.
const SYNONYMS: Record<string, string[]> = {
  liegestutz: ["pushup", "liegestutz"],
  klimmzug: ["pullup", "chinup", "klimmzug"],
  kniebeuge: ["squat", "kniebeuge"],
  kreuzheben: ["deadlift", "kreuzheben"],
  ausfallschritt: ["lunge", "ausfallschritt"],
  bankdrucken: ["benchpress", "bankdrucken"],
  schulterdrucken: ["shoulderpress", "overheadpress", "militarypress", "schulterdrucken"],
  sprung: ["jump", "sprung"],
  springen: ["jump", "sprung"],
  rudern: ["row", "rudern"],
  huftheben: ["hipthrust", "glutebridge", "huftheben"],
  unterarmstutz: ["plank", "unterarmstutz"],
  plank: ["plank", "unterarmstutz"],
  goodmorning: ["goodmorning"],
  muscleup: ["muscleup"],
};

// Words that carry no exercise meaning once a phrase is split off ("bitte keine Burpees mehr").
const FILLER = new Set(
  [
    "kein", "keine", "keinen", "keinem", "keiner", "keines", "ohne", "nicht", "nichts", "no", "not",
    "without", "bitte", "mehr", "übung", "übungen", "mag", "ich", "will", "möchte", "machen",
    "mache", "auch", "gar", "die", "der", "das", "den", "dem", "eine", "einen", "any", "please",
    "exercise", "exercises", "the", "gerät", "geräte", "equipment", "schmerz", "schmerzen",
    "problem", "probleme", "pause", "pausen",
  ].map(compact),
);

// "keinen Handstand", "ohne Burpees", "no handstand" in free text that may say plenty of other
// things: only the 1-2 words right after the negation are taken.
const NEGATION = /(?:^|[^\p{L}])(?:kein(?:e|en|em|er|es)?|ohne|no|without)\s+([\p{L}-]+(?:\s+[\p{L}-]+)?)/giu;

// The word plus its forms without plural/case endings, so "Handstände", "Burpees" and
// "Klimmzügen" find their catalog names. Umlauts are already folded (Handstände → handstande).
function variants(word: string): string[] {
  const out = new Set([word]);
  for (const suffix of ["en", "n", "e", "s"]) {
    if (word.length - suffix.length >= 4 && word.endsWith(suffix)) out.add(word.slice(0, -suffix.length));
  }
  for (const v of [...out]) SYNONYMS[v]?.forEach((s) => out.add(s));
  // Shortest forms are enough for a substring match and keep the matcher readable.
  return [...out].filter((v) => ![...out].some((o) => o !== v && v.includes(o)));
}

function matcherForTerm(term: string): AvoidMatcher | null {
  const joined = compact(term);
  // Known multi-word names ("good morning", "muscle-up") stay one word.
  if (SYNONYMS[joined]) return [variants(joined)];
  const words = term
    .split(/[\s/]+/)
    .map(compact)
    .filter((w) => w.length >= 3 && !FILLER.has(w));
  if (words.length === 0) return null;
  // Single words must be specific enough not to wipe out the catalog by accident.
  if (words.length === 1 && words[0].length < 4 && !SYNONYMS[words[0]]) return null;
  return words.map(variants);
}

// `avoidedList` is the dedicated "Übungen vermeiden" field: every comma/line separated entry is
// an exercise to drop. `freeTexts` (limitations, plan remarks) only contribute negated phrases.
export function buildAvoidMatchers(
  avoidedList: string | null | undefined,
  ...freeTexts: Array<string | null | undefined>
): AvoidMatcher[] {
  const matchers: AvoidMatcher[] = [];
  const add = (term: string) => {
    const m = matcherForTerm(term);
    if (m) matchers.push(m);
  };
  if (avoidedList?.trim()) {
    avoidedList.split(/[,;\n]|\s(?:und|oder|and|or)\s/i).forEach(add);
  }
  for (const text of freeTexts) {
    if (!text) continue;
    for (const match of text.matchAll(NEGATION)) {
      // A known two-word name counts as a whole; otherwise only the first word after the
      // negation ("keinen Handstand mehr" → handstand) — the next word is often unrelated.
      const phrase = match[1];
      add(SYNONYMS[compact(phrase)] ? phrase : phrase.split(/\s+/)[0]);
    }
  }
  return matchers;
}

export function isAvoided(exercise: { name: string; nameDe?: string | null }, matchers: AvoidMatcher[]): boolean {
  if (matchers.length === 0) return false;
  const names = [compact(exercise.name), compact(exercise.nameDe ?? "")];
  return matchers.some((matcher) =>
    names.some((name) => name && matcher.every((alternatives) => alternatives.some((a) => name.includes(a)))),
  );
}
