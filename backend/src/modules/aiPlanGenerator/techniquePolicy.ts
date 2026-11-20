import {
  GROUP_SIZE,
  TECHNIQUES,
  TECHNIQUE_INFO,
  maxTechniquesPerDay,
  techniqueAllowedFor,
  type ExperienceLevel,
  type PhaseStyle,
  type Technique,
} from "@fitnesstracker/shared";
import { SET_SCHEMES, type SetScheme } from "@fitnesstracker/shared";

// What the AI may propose for intensity techniques and set schemes is only a suggestion: this is the
// check that decides what survives. The rules are deliberately strict — a plan full of drop sets and
// giant sets wears the user out — and everything is checked against the user's own selection.
//
// Pure (no database), so it is unit-tested.

export interface PolicyExercise {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

// One exercise of a day as the AI returned it (after the usual catalog checks), in plan order.
export interface PolicyItem {
  day: string;
  exerciseId: string;
  technique: string | null | undefined;
  techniqueGroup: string | null | undefined;
  setScheme: string | null | undefined;
}

export interface PolicyOptions {
  // What the user ticked in the questionnaire (empty = none).
  allowedTechniques: readonly Technique[];
  allowedSchemes: readonly ("PYRAMID" | "TIME_BASED")[];
  experience: ExperienceLevel;
  exercisesPerDay: number;
  style: PhaseStyle | null | undefined;
}

export interface PolicyResult {
  // Same exercises, possibly reordered so the members of a group stand next to each other.
  items: Array<{ exerciseId: string; day: string; technique: Technique | null; techniqueGroup: string | null; setScheme: SetScheme | null }>;
  // Why something was dropped — for logs and tests, not shown to the user.
  dropped: string[];
}

const COMPOUND_NAME = /(squat|deadlift|bench press|incline press|military press|overhead press|shoulder press|\brow\b|pull-?up|chin-?up|pulldown|\bdips?\b|lunge|clean|snatch|thrust|good morning|push-?up|leg press)/i;
const ISOLATION_NAME = /(raise|curl|extension|fl[yi]e|pushdown|kickback|crossover|pullover|shrug|crunch|abduct|adduct|calf)/i;

// The catalog has no "compound or isolation" flag, so it is guessed from the name and the muscles
// involved: a press or a row is compound, a raise or a curl is not.
export function isCompoundExercise(e: Pick<PolicyExercise, "name" | "secondaryMuscles">): boolean {
  if (ISOLATION_NAME.test(e.name) && !COMPOUND_NAME.test(e.name)) return false;
  if (COMPOUND_NAME.test(e.name)) return true;
  return e.secondaryMuscles.length >= 3;
}

// Holds (plank, wall sit, hanging) are the exercises it makes sense to time.
export function isHoldExercise(e: Pick<PolicyExercise, "name">): boolean {
  return /(plank|wall sit|hold|hang|isometric|bridge|l-sit|dead hang)/i.test(e.name);
}

const SMALL_MUSCLES = new Set(["biceps", "triceps", "forearms", "calves", "abdominals", "shoulders"]);

// Antagonist pairs a superset should come from (either way round).
const ANTAGONISTS: Array<[string, string]> = [
  ["chest", "lats"],
  ["chest", "middle back"],
  ["biceps", "triceps"],
  ["quadriceps", "hamstrings"],
  ["shoulders", "lats"],
  ["abdominals", "lower back"],
];

function antagonistPair(a: string, b: string): boolean {
  return ANTAGONISTS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function equipmentOf(e: PolicyExercise): string {
  return (e.equipment ?? "other").toLowerCase();
}

const MACHINE_LIKE = new Set(["machine", "cable", "dumbbell"]);

function toTechnique(value: string | null | undefined): Technique | null {
  const v = value?.trim().toUpperCase();
  return (TECHNIQUES as readonly string[]).includes(v ?? "") ? (v as Technique) : null;
}

function toScheme(value: string | null | undefined): SetScheme | null {
  const v = value?.trim().toUpperCase();
  return (SET_SCHEMES as readonly string[]).includes(v ?? "") && v !== "STRAIGHT" ? (v as SetScheme) : null;
}

// Does the technique make sense for this single exercise (segment and cue techniques)?
function fitsExercise(technique: Technique, e: PolicyExercise, isFirstOfDay: boolean): string | null {
  const compound = isCompoundExercise(e);
  const eq = equipmentOf(e);
  switch (technique) {
    case "DROPSET":
    case "REST_PAUSE":
    case "MYO_REPS":
      if (compound) return "heavy compound exercise";
      if (!MACHINE_LIKE.has(eq)) return "equipment does not suit quick weight changes";
      if (isFirstOfDay) return "first exercise of the day";
      return null;
    case "PARTIAL_REPS":
      if (compound) return "compound exercise";
      if (eq !== "machine" && eq !== "cable") return "needs a guided movement";
      return null;
    case "TWENTY_ONES":
      if (compound) return "compound exercise";
      if (!SMALL_MUSCLES.has(e.primaryMuscles[0] ?? "")) return "not a small muscle";
      return null;
    case "CLUSTER":
      if (!compound) return "not a heavy compound exercise";
      return null;
    default:
      return null;
  }
}

export function applyTechniquePolicy(
  items: PolicyItem[],
  exercises: Map<string, PolicyExercise>,
  options: PolicyOptions,
): PolicyResult {
  const dropped: string[] = [];
  const allowed = new Set(
    options.allowedTechniques.filter((t) => techniqueAllowedFor(t, options.experience)),
  );
  const noTechniques = options.style === "DELOAD" || allowed.size === 0;
  const maxPerDay = maxTechniquesPerDay(options.exercisesPerDay, options.experience);
  const result: PolicyResult["items"] = [];

  const days = [...new Set(items.map((i) => i.day))];
  for (const day of days) {
    const dayItems = items.filter((i) => i.day === day);
    type Work = { item: PolicyItem; e: PolicyExercise | undefined; technique: Technique | null; group: string | null; scheme: SetScheme | null };
    let work: Work[] = dayItems.map((item) => ({
      item,
      e: exercises.get(item.exerciseId),
      technique: toTechnique(item.technique),
      group: item.techniqueGroup?.trim() || null,
      scheme: toScheme(item.setScheme),
    }));

    // 1) Only what the user ticked, only for their level, nothing in a deload.
    for (const w of work) {
      if (!w.technique) continue;
      if (noTechniques || !allowed.has(w.technique)) {
        dropped.push(`${w.item.exerciseId}: ${w.technique} not allowed`);
        w.technique = null;
        w.group = null;
      }
    }

    // 2) Group techniques: the members must fit together, otherwise nobody gets the technique.
    const groups = new Map<string, Work[]>();
    for (const w of work) {
      if (w.technique && GROUP_SIZE[w.technique]) {
        if (!w.group) {
          dropped.push(`${w.item.exerciseId}: ${w.technique} without a group`);
          w.technique = null;
          continue;
        }
        groups.set(w.group, [...(groups.get(w.group) ?? []), w]);
      } else {
        w.group = null;
      }
    }
    for (const [key, members] of groups) {
      const technique = members[0].technique as Technique;
      const size = GROUP_SIZE[technique]!;
      const reason = groupProblem(technique, members.map((m) => m.e), size);
      if (members.some((m) => m.technique !== technique)) {
        dropped.push(`group ${key}: mixed techniques`);
      } else if (reason) {
        dropped.push(`group ${key}: ${reason}`);
      } else {
        continue;
      }
      for (const m of members) {
        m.technique = null;
        m.group = null;
      }
    }

    // 3) Segment and cue techniques have to suit the single exercise.
    work.forEach((w, index) => {
      if (!w.technique || GROUP_SIZE[w.technique] || !w.e) return;
      const problem = fitsExercise(w.technique, w.e, index === 0);
      if (problem) {
        dropped.push(`${w.item.exerciseId}: ${w.technique} — ${problem}`);
        w.technique = null;
      }
    });

    // 4) Sparing: at most N per day (a group counts once), never the same one on neighbours.
    let used = 0;
    const seenGroups = new Set<string>();
    let previous: Technique | null = null;
    for (const w of work) {
      if (!w.technique) {
        previous = null;
        continue;
      }
      const newGroup = w.group !== null && !seenGroups.has(w.group);
      const counts = w.group === null || newGroup;
      if (counts && used >= maxPerDay) {
        dropped.push(`${w.item.exerciseId}: more than ${maxPerDay} per day`);
        dropRemaining(work, w);
        continue;
      }
      if (w.group === null && previous === w.technique) {
        dropped.push(`${w.item.exerciseId}: same technique twice in a row`);
        w.technique = null;
        previous = null;
        continue;
      }
      if (counts) used += 1;
      if (w.group !== null) seenGroups.add(w.group);
      previous = w.technique;
    }

    // 5) Members of a group stand next to each other; pre-exhaust starts with the isolation exercise,
    // post-exhaust with the compound one.
    work = arrangeGroups(work);

    // 6) Set schemes: only what was ticked, sparing, and only where they make sense.
    const schemeCap = options.experience === "beginner" ? 1 : 2;
    let schemes = 0;
    for (const w of work) {
      if (!w.scheme) continue;
      const ok =
        !!w.e &&
        options.style !== "DELOAD" &&
        w.group === null &&
        schemes < schemeCap &&
        (options.allowedSchemes as readonly SetScheme[]).includes(w.scheme) &&
        (w.scheme === "PYRAMID" ? isCompoundExercise(w.e) && options.style !== "ENDURANCE" : isHoldExercise(w.e));
      if (!ok) {
        dropped.push(`${w.item.exerciseId}: scheme ${w.scheme} not used`);
        w.scheme = null;
        continue;
      }
      schemes += 1;
    }

    // Group keys are renamed G1, G2, ... per day.
    const rename = new Map<string, string>();
    for (const w of work) {
      if (w.group && !rename.has(w.group)) rename.set(w.group, `G${rename.size + 1}`);
      result.push({
        exerciseId: w.item.exerciseId,
        day,
        technique: w.technique,
        techniqueGroup: w.group ? (rename.get(w.group) as string) : null,
        setScheme: w.scheme,
      });
    }
  }
  return { items: result, dropped };
}

function dropRemaining(work: Array<{ technique: Technique | null; group: string | null }>, from: { technique: Technique | null; group: string | null }) {
  // Removing one member would leave the others of its group without a partner: take the group.
  for (const w of work) {
    if (w === from || (from.group !== null && w.group === from.group)) {
      w.technique = null;
      w.group = null;
    }
  }
}

function groupProblem(technique: Technique, members: Array<PolicyExercise | undefined>, size: { min: number; max: number }): string | null {
  if (members.length < size.min || members.length > size.max) return `needs ${size.min}-${size.max} exercises, has ${members.length}`;
  if (members.some((m) => !m)) return "unknown exercise";
  const es = members as PolicyExercise[];
  const muscles = es.map((e) => e.primaryMuscles[0] ?? "");
  switch (technique) {
    case "SUPERSET":
      return antagonistPair(muscles[0], muscles[1]) ? null : "not opposing muscles";
    case "COMPOUND_SET":
    case "GIANT_SET":
      return muscles.every((m) => m === muscles[0]) ? null : "different muscles";
    case "PRE_EXHAUST":
    case "POST_EXHAUST": {
      if (muscles[0] !== muscles[1]) return "different muscles";
      const compounds = es.map(isCompoundExercise);
      return compounds[0] !== compounds[1] ? null : "needs one compound and one isolation exercise";
    }
    default:
      return null;
  }
}

function arrangeGroups<T extends { item: PolicyItem; e: PolicyExercise | undefined; technique: Technique | null; group: string | null }>(work: T[]): T[] {
  const out: T[] = [];
  const placed = new Set<T>();
  for (const w of work) {
    if (placed.has(w)) continue;
    if (!w.group) {
      out.push(w);
      placed.add(w);
      continue;
    }
    let members = work.filter((m) => m.group === w.group);
    if (w.technique === "PRE_EXHAUST") members = [...members].sort((a, b) => Number(isCompoundExercise(a.e!)) - Number(isCompoundExercise(b.e!)));
    if (w.technique === "POST_EXHAUST") members = [...members].sort((a, b) => Number(isCompoundExercise(b.e!)) - Number(isCompoundExercise(a.e!)));
    for (const m of members) {
      out.push(m);
      placed.add(m);
    }
  }
  return out;
}

// What the prompt tells the model about the techniques the user picked.
export function techniquePromptSection(options: {
  allowedTechniques: readonly Technique[];
  allowedSchemes: readonly ("PYRAMID" | "TIME_BASED")[];
  allowedPeriodizations: readonly ("LINEAR" | "WAVE")[];
  experience: ExperienceLevel;
  exercisesPerDay: number;
  style: PhaseStyle | null | undefined;
}): string {
  if (options.style === "DELOAD") return "";
  const techniques = options.allowedTechniques.filter((t) => techniqueAllowedFor(t, options.experience));
  const cap = maxTechniquesPerDay(options.exercisesPerDay, options.experience);
  const parts: string[] = [];
  if (techniques.length > 0) {
    parts.push(
      `INTENSITÄTSTECHNIKEN (nur diese darfst du verwenden, der Nutzer hat sie ausgewählt):\n` +
        techniques.map((t) => `- ${t} (${TECHNIQUE_INFO[t].label}): ${TECHNIQUE_INFO[t].short}`).join("\n") +
        `\nSetze sie SPARSAM ein, nur wo sie fachlich Sinn machen — höchstens ${cap} pro Trainingstag, ein ganzer Plan voller Techniken ist falsch. ` +
        `Wenn keine Technik sinnvoll ist, verwende keine. Regeln: Dropsatz, Rest-Pause, Myo-Reps und Teilwiederholungen nur bei Isolations- oder Maschinen-/Kabelübungen und nie bei der ersten Übung des Tages; ` +
        `Cluster nur bei schweren Grundübungen; 21er nur bei kleinen Muskeln; Supersatz nur für gegenüberliegende Muskeln (z. B. Brust/Rücken, Bizeps/Trizeps); ` +
        `Verbundsatz und Riesensatz für denselben Muskel; Vorermüdung = erst Isolationsübung, dann Grundübung desselben Muskels; Nachermüdung umgekehrt. ` +
        `Für Übungen, die zusammen gemacht werden (Supersatz, Verbundsatz, Vor-/Nachermüdung, Riesensatz), gib allen Mitgliedern denselben "techniqueGroup"-Namen (z. B. "G1") am selben Tag und direkt aufeinanderfolgende "order"-Werte.`,
    );
  }
  const schemes = options.allowedSchemes;
  if (schemes.length > 0) {
    parts.push(
      `SATZSCHEMATA (optional pro Übung im Feld "setScheme", sonst "STRAIGHT"): ` +
        [
          schemes.includes("PYRAMID") ? `PYRAMID = Pyramide, Gewicht steigt von Satz zu Satz, Wiederholungen sinken (nur schwere Grundübungen, höchstens eine bis zwei pro Tag)` : null,
          schemes.includes("TIME_BASED") ? `TIME_BASED = zeitbasiert, Sekunden statt Wiederholungen (nur Halteübungen wie Plank oder Wandsitzen)` : null,
        ]
          .filter(Boolean)
          .join("; ") +
        `. Gleichbleibende Sätze (STRAIGHT) sind der Normalfall.`,
    );
  }
  const periodizations = options.allowedPeriodizations;
  if (periodizations.length > 0 && options.style !== "MAINTAIN") {
    parts.push(
      `WOCHENVERLAUF der Phase (optionales Feld "periodization" auf oberster Ebene, sonst null): ` +
        [
          periodizations.includes("LINEAR") ? `LINEAR = über die Wochen weniger Wiederholungen und schwerer` : null,
          periodizations.includes("WAVE") ? `WAVE = Wellen aus mittlerer, schwerer und leichter Woche` : null,
        ]
          .filter(Boolean)
          .join("; ") +
        `. Wähle nur, wenn es zu Ziel und Erfahrung passt.`,
    );
  }
  if (parts.length === 0) return "";
  parts.push(
    `Ergänze im JSON pro Eintrag optional: "technique": "<TECHNIK oder null>", "techniqueGroup": "<G1 oder null>", "setScheme": "<${["STRAIGHT", ...schemes].join(", ")}>"` +
      (options.allowedPeriodizations.length > 0 && options.style !== "MAINTAIN" ? ` und auf oberster Ebene "periodization": "<LINEAR, WAVE oder null>".` : `.`),
  );
  return `\n\n${parts.join("\n\n")}`;
}
