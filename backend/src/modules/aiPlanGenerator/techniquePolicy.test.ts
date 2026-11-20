import { describe, expect, it } from "vitest";
import {
  applyTechniquePolicy,
  isCompoundExercise,
  isHoldExercise,
  techniquePromptSection,
  type PolicyExercise,
  type PolicyItem,
  type PolicyOptions,
} from "./techniquePolicy.js";

const ex = (id: string, name: string, equipment: string, primary: string, secondary: string[] = []): PolicyExercise => ({
  id,
  name,
  equipment,
  primaryMuscles: [primary],
  secondaryMuscles: secondary,
});

const catalog = new Map(
  [
    ex("bench", "Barbell Bench Press - Medium Grip", "barbell", "chest", ["triceps", "shoulders"]),
    ex("row", "Bent Over Barbell Row", "barbell", "lats", ["biceps", "middle back"]),
    ex("fly", "Cable Crossover", "cable", "chest"),
    ex("curl", "Dumbbell Bicep Curl", "dumbbell", "biceps"),
    ex("pushdown", "Triceps Pushdown", "cable", "triceps"),
    ex("raise", "Side Lateral Raise", "dumbbell", "shoulders"),
    ex("legext", "Leg Extensions", "machine", "quadriceps"),
    ex("legcurl", "Lying Leg Curls", "machine", "hamstrings"),
    ex("squat", "Barbell Squat", "barbell", "quadriceps", ["glutes", "hamstrings", "calves"]),
    ex("plank", "Plank", "body only", "abdominals"),
    ex("press", "Dumbbell Bench Press", "dumbbell", "chest", ["triceps", "shoulders"]),
  ].map((e) => [e.id, e]),
);

const item = (day: string, exerciseId: string, over: Partial<PolicyItem> = {}): PolicyItem => ({
  day,
  exerciseId,
  technique: null,
  techniqueGroup: null,
  setScheme: null,
  ...over,
});

const options = (over: Partial<PolicyOptions> = {}): PolicyOptions => ({
  allowedTechniques: ["SUPERSET", "DROPSET", "PRE_EXHAUST", "COMPOUND_SET", "GIANT_SET", "REST_PAUSE", "TWENTY_ONES", "CLUSTER"],
  allowedSchemes: ["PYRAMID", "TIME_BASED"],
  experience: "advanced",
  exercisesPerDay: 6,
  style: null,
  ...over,
});

describe("exercise heuristics", () => {
  it("tells compound from isolation exercises", () => {
    expect(isCompoundExercise(catalog.get("bench")!)).toBe(true);
    expect(isCompoundExercise(catalog.get("squat")!)).toBe(true);
    expect(isCompoundExercise(catalog.get("curl")!)).toBe(false);
    expect(isCompoundExercise(catalog.get("raise")!)).toBe(false);
    expect(isCompoundExercise(catalog.get("fly")!)).toBe(false);
  });

  it("recognises hold exercises", () => {
    expect(isHoldExercise({ name: "Plank" })).toBe(true);
    expect(isHoldExercise({ name: "Barbell Squat" })).toBe(false);
  });
});

describe("applyTechniquePolicy", () => {
  it("keeps nothing the user did not tick", () => {
    const result = applyTechniquePolicy(
      [item("A", "bench"), item("A", "curl", { technique: "MYO_REPS" })],
      catalog,
      options({ allowedTechniques: ["SUPERSET"] }),
    );
    expect(result.items.every((i) => i.technique === null)).toBe(true);
  });

  it("uses no technique at all when none was ticked, or in a deload", () => {
    const items = [item("A", "bench"), item("A", "curl", { technique: "DROPSET" })];
    expect(applyTechniquePolicy(items, catalog, options({ allowedTechniques: [] })).items.every((i) => !i.technique)).toBe(true);
    expect(applyTechniquePolicy(items, catalog, options({ style: "DELOAD" })).items.every((i) => !i.technique)).toBe(true);
  });

  it("keeps a valid superset of opposing muscles and puts the pair next to each other", () => {
    const result = applyTechniquePolicy(
      [
        item("A", "bench", { technique: "SUPERSET", techniqueGroup: "x" }),
        item("A", "squat"),
        item("A", "row", { technique: "SUPERSET", techniqueGroup: "x" }),
      ],
      catalog,
      options(),
    );
    expect(result.items.map((i) => i.exerciseId)).toEqual(["bench", "row", "squat"]);
    expect(result.items[0]).toMatchObject({ technique: "SUPERSET", techniqueGroup: "G1" });
    expect(result.items[1]).toMatchObject({ technique: "SUPERSET", techniqueGroup: "G1" });
    expect(result.items[2].technique).toBeNull();
  });

  it("drops a superset of two exercises for the same muscle, or with a missing partner", () => {
    const sameMuscle = applyTechniquePolicy(
      [item("A", "bench", { technique: "SUPERSET", techniqueGroup: "x" }), item("A", "fly", { technique: "SUPERSET", techniqueGroup: "x" })],
      catalog,
      options(),
    );
    expect(sameMuscle.items.every((i) => !i.technique)).toBe(true);
    const alone = applyTechniquePolicy([item("A", "bench", { technique: "SUPERSET", techniqueGroup: "x" })], catalog, options());
    expect(alone.items[0].technique).toBeNull();
    const noKey = applyTechniquePolicy([item("A", "bench", { technique: "SUPERSET" }), item("A", "row", { technique: "SUPERSET" })], catalog, options());
    expect(noKey.items.every((i) => !i.technique)).toBe(true);
  });

  it("orders pre-exhaust as isolation first, compound second", () => {
    const result = applyTechniquePolicy(
      [item("A", "bench", { technique: "PRE_EXHAUST", techniqueGroup: "p" }), item("A", "fly", { technique: "PRE_EXHAUST", techniqueGroup: "p" })],
      catalog,
      options(),
    );
    expect(result.items.map((i) => i.exerciseId)).toEqual(["fly", "bench"]);
    expect(result.items[0].technique).toBe("PRE_EXHAUST");
  });

  it("allows drop sets only on isolation or machine exercises after the first one", () => {
    const run = (id: string, first: boolean) => {
      const dropped = item("A", id, { technique: "DROPSET" });
      const filler = item("A", "raise");
      const items = first ? [dropped, filler] : [filler, dropped];
      return applyTechniquePolicy(items, catalog, options()).items.find((i) => i.exerciseId === id)!;
    };
    expect(run("squat", false).technique).toBeNull(); // heavy barbell compound
    expect(run("legext", true).technique).toBeNull(); // first exercise of the day
    expect(run("legext", false).technique).toBe("DROPSET");
  });

  it("caps techniques per day and never repeats one on neighbours", () => {
    const items = [
      item("A", "bench"),
      item("A", "curl", { technique: "DROPSET" }),
      item("A", "pushdown", { technique: "DROPSET" }),
      item("A", "raise", { technique: "REST_PAUSE" }),
      item("A", "legext", { technique: "DROPSET" }),
    ];
    const result = applyTechniquePolicy(items, catalog, options({ exercisesPerDay: 5, experience: "advanced" }));
    const used = result.items.filter((i) => i.technique);
    expect(used.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < result.items.length; i++) {
      if (result.items[i].technique) expect(result.items[i].technique).not.toBe(result.items[i - 1].technique);
    }
  });

  it("is stricter for beginners: one a day, only the easy ones", () => {
    const items = [
      item("A", "bench", { technique: "SUPERSET", techniqueGroup: "s" }),
      item("A", "row", { technique: "SUPERSET", techniqueGroup: "s" }),
      item("A", "curl", { technique: "DROPSET" }),
    ];
    const result = applyTechniquePolicy(items, catalog, options({ experience: "beginner" }));
    expect(result.items.filter((i) => i.technique)).toHaveLength(2); // the superset pair counts once, the drop set is not for beginners
    expect(result.items.find((i) => i.exerciseId === "curl")!.technique).toBeNull();
  });

  it("only uses ticked set schemes, and for the right exercises", () => {
    const items = [
      item("A", "bench", { setScheme: "PYRAMID" }),
      item("A", "curl", { setScheme: "PYRAMID" }),
      item("A", "plank", { setScheme: "TIME_BASED" }),
      item("A", "squat", { setScheme: "TIME_BASED" }),
    ];
    const result = applyTechniquePolicy(items, catalog, options());
    expect(result.items.map((i) => i.setScheme)).toEqual(["PYRAMID", null, "TIME_BASED", null]);
    const off = applyTechniquePolicy(items, catalog, options({ allowedSchemes: [] }));
    expect(off.items.every((i) => !i.setScheme)).toBe(true);
  });

  it("ignores unknown values from the model", () => {
    const result = applyTechniquePolicy([item("A", "curl", { technique: "SUPER_DUPER", setScheme: "ZIGZAG" })], catalog, options());
    expect(result.items[0]).toMatchObject({ technique: null, setScheme: null });
  });
});

describe("techniquePromptSection", () => {
  it("is empty in a deload and without choices", () => {
    expect(techniquePromptSection({ allowedTechniques: ["DROPSET"], allowedSchemes: [], allowedPeriodizations: [], experience: "advanced", exercisesPerDay: 6, style: "DELOAD" })).toBe("");
    expect(techniquePromptSection({ allowedTechniques: [], allowedSchemes: [], allowedPeriodizations: [], experience: "advanced", exercisesPerDay: 6, style: null })).toBe("");
  });

  it("lists only the allowed techniques and tells the model to be sparing", () => {
    const text = techniquePromptSection({ allowedTechniques: ["DROPSET", "SUPERSET", "MYO_REPS"], allowedSchemes: ["PYRAMID"], allowedPeriodizations: ["WAVE"], experience: "intermediate", exercisesPerDay: 6, style: null });
    expect(text).toContain("DROPSET");
    expect(text).toContain("SUPERSET");
    expect(text).not.toContain("MYO_REPS"); // advanced only
    expect(text).toContain("SPARSAM");
    expect(text).toContain("höchstens 2 pro Trainingstag");
    expect(text).toContain("PYRAMID");
    expect(text).toContain("WAVE");
    expect(text).not.toContain("TIME_BASED");
  });
});
