import { describe, expect, it } from "vitest";
import { buildAvoidMatchers, isAvoided } from "./avoidFilter.js";
import { buildExclusions, isExcluded } from "./injuryFilter.js";

const handstandPushUp = { name: "Handstand Push-Ups", nameDe: "Handstand-Liegestütze", primaryMuscles: ["shoulders"] };
const pushUp = { name: "Pushups", nameDe: "Liegestütze", primaryMuscles: ["chest"] };
const burpee = { name: "Burpee", nameDe: null, primaryMuscles: ["quadriceps"] };
const pullUp = { name: "Pullups", nameDe: "Klimmzüge", primaryMuscles: ["lats"] };
const squat = { name: "Barbell Squat", nameDe: "Kniebeuge mit Langhantel", primaryMuscles: ["quadriceps"] };
const legPress = { name: "Leg Press", nameDe: "Beinpresse", primaryMuscles: ["quadriceps"] };
const goodMorning = { name: "Good Morning", nameDe: null, primaryMuscles: ["hamstrings"] };

describe("avoid filter", () => {
  it("drops handstand exercises for 'keinen Handstand' in the avoid field", () => {
    const m = buildAvoidMatchers("keinen Handstand");
    expect(isAvoided(handstandPushUp, m)).toBe(true);
    expect(isAvoided(pushUp, m)).toBe(false);
  });

  it("handles plural and umlaut forms", () => {
    expect(isAvoided(handstandPushUp, buildAvoidMatchers("Handstände"))).toBe(true);
    expect(isAvoided(burpee, buildAvoidMatchers("Burpees"))).toBe(true);
    expect(isAvoided(pullUp, buildAvoidMatchers("Klimmzügen"))).toBe(true);
  });

  it("maps German exercise words to English catalog names", () => {
    const m = buildAvoidMatchers("Kniebeugen, Liegestütze");
    expect(isAvoided(squat, m)).toBe(true);
    expect(isAvoided(pushUp, m)).toBe(true);
    expect(isAvoided(legPress, m)).toBe(false);
  });

  it("a multi-word entry only drops exercises matching all words", () => {
    const m = buildAvoidMatchers("Handstand Liegestütze");
    expect(isAvoided(handstandPushUp, m)).toBe(true);
    expect(isAvoided(pushUp, m)).toBe(false);
  });

  it("splits entries on commas, lines and 'und'", () => {
    const m = buildAvoidMatchers("Burpees und Handstand\nGood Mornings");
    expect(isAvoided(burpee, m)).toBe(true);
    expect(isAvoided(handstandPushUp, m)).toBe(true);
    expect(isAvoided(goodMorning, m)).toBe(true);
    expect(isAvoided(squat, m)).toBe(false);
  });

  it("takes only negated phrases from free text", () => {
    const m = buildAvoidMatchers(null, "Bitte keinen Handstand mehr. Schultern priorisieren, ohne Burpees.");
    expect(isAvoided(handstandPushUp, m)).toBe(true);
    expect(isAvoided(burpee, m)).toBe(true);
    expect(isAvoided(squat, m)).toBe(false);
    expect(isAvoided(pushUp, m)).toBe(false);
  });

  it("ignores harmless negations and empty input", () => {
    const m = buildAvoidMatchers("keine", "keine Schmerzen, ohne Geräte trainieren geht auch");
    expect(m).toEqual([]);
    expect(isAvoided(legPress, buildAvoidMatchers(undefined))).toBe(false);
  });

  it("is applied by isExcluded through the exclusions object", () => {
    const exclusions = { ...buildExclusions(undefined), avoid: buildAvoidMatchers("keinen Handstand") };
    expect(isExcluded(handstandPushUp, exclusions)).toBe(true);
    expect(isExcluded(pushUp, exclusions)).toBe(false);
  });
});
