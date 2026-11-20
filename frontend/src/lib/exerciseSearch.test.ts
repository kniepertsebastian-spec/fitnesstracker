import { describe, expect, it } from "vitest";
import type { ExerciseDto } from "@fitnesstracker/shared";
import { catalogFacets, filterCatalog, normalizeSearch } from "./exerciseSearch";

const ex = (id: string, name: string, nameEn: string, over: Partial<ExerciseDto> = {}): ExerciseDto => ({
  id,
  name,
  nameEn,
  description: null,
  videoUrl: null,
  imageUrls: [],
  equipment: "barbell",
  category: "strength",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["triceps"],
  source: "free-exercise-db",
  isActive: true,
  ...over,
});

const catalog = [
  ex("1", "Kreuzheben", "Barbell Deadlift", { primaryMuscles: ["lower back"], secondaryMuscles: ["glutes", "hamstrings"] }),
  ex("2", "Bankdrücken, mittlerer Griff (Langhantel)", "Barbell Bench Press - Medium Grip"),
  ex("3", "Seitheben", "Side Lateral Raise", { equipment: "dumbbell", primaryMuscles: ["shoulders"], secondaryMuscles: [] }),
  ex("4", "Alte Übung", "Old Exercise", { isActive: false }),
  ex("5", "Liegestütze", "Pushups", { equipment: "body only" }),
];

describe("normalizeSearch", () => {
  it("ignores case, umlauts, ß and punctuation", () => {
    expect(normalizeSearch("Bankdrücken, mittlerer Griff (Langhantel)")).toBe("bankdrucken mittlerer griff langhantel");
    expect(normalizeSearch("Fußstütze")).toBe("fussstutze");
  });
});

describe("filterCatalog", () => {
  const names = (search: string, extra: Partial<Parameters<typeof filterCatalog>[1]> = {}) =>
    filterCatalog(catalog, { search, ...extra }).map((e) => e.name);

  it("finds an exercise by its English name, so 'deadlift' finds Kreuzheben", () => {
    expect(names("deadlift")).toEqual(["Kreuzheben"]);
    expect(names("Deadlift")).toEqual(["Kreuzheben"]);
  });

  it("finds by German name without umlauts", () => {
    expect(names("bankdrucken")).toEqual(["Bankdrücken, mittlerer Griff (Langhantel)"]);
    expect(names("liegestutze")).toEqual(["Liegestütze"]);
  });

  it("matches several words in any order", () => {
    expect(names("griff bench")).toEqual(["Bankdrücken, mittlerer Griff (Langhantel)"]);
    expect(names("seit bench")).toEqual([]);
  });

  it("finds by muscle and equipment in German or English", () => {
    expect(names("brust")).toEqual(["Bankdrücken, mittlerer Griff (Langhantel)", "Liegestütze"]);
    expect(names("shoulders")).toEqual(["Seitheben"]);
    expect(names("kurzhantel")).toEqual(["Seitheben"]);
  });

  it("puts name matches before muscle matches", () => {
    const list = [
      ex("a", "Brust-Fliegende", "Chest Fly"),
      ex("b", "Schrägbankdrücken", "Incline Press", { primaryMuscles: ["chest"] }),
    ];
    // "brust": the first has it in its name, the second only as the muscle
    expect(filterCatalog(list, { search: "brust" }).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("filters by muscle group and equipment, hides inactive ones by default", () => {
    expect(names("", { muscleGroup: "glutes" })).toEqual(["Kreuzheben"]);
    expect(names("", { equipment: "Dumbbell" })).toEqual(["Seitheben"]);
    expect(names("")).not.toContain("Alte Übung");
    expect(names("", { includeInactive: true })).toContain("Alte Übung");
  });

  it("keeps the catalog order without a query", () => {
    expect(names("")).toEqual(["Kreuzheben", "Bankdrücken, mittlerer Griff (Langhantel)", "Seitheben", "Liegestütze"]);
  });
});

describe("catalogFacets", () => {
  it("lists muscles and equipment once, sorted", () => {
    const f = catalogFacets(catalog);
    expect(f.muscleGroups).toEqual(["chest", "glutes", "hamstrings", "lower back", "shoulders", "triceps"]);
    expect(f.equipment).toEqual(["barbell", "body only", "dumbbell"]);
  });
});
