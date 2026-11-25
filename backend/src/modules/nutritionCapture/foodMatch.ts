import type { PrismaClient } from "@prisma/client";
import { searchFoods, type FoodDto } from "../foods/food.service.js";

// Matching names the AI read (spoken foods, recipe ingredients) against the food layers: the
// user's own foods first, then BLS, then the OFF cache (the ranking of searchFoods). The AI never
// supplies nutrients; the app shows these candidates and the user confirms one.

export const MATCH_CANDIDATES = 3;

export interface FoodCandidate {
  id: string;
  name: string;
  brand: string | null;
  source: FoodDto["source"];
  own: boolean;
  basis: FoodDto["basis"];
  densityGPerMl: number | null;
  per100: FoodDto["per100"];
  estimatedFields: FoodDto["estimatedFields"];
  units: { label: string; baseAmount: number }[];
}

export type FoodMatcher = (name: string) => Promise<FoodCandidate[]>;

const toCandidate = (f: FoodDto): FoodCandidate => ({
  id: f.id,
  name: f.name,
  brand: f.brand,
  source: f.source,
  own: f.own,
  basis: f.basis,
  densityGPerMl: f.densityGPerMl,
  per100: f.per100,
  estimatedFields: f.estimatedFields,
  units: f.units.map((u) => ({ label: u.label, baseAmount: u.baseAmount })),
});

// Words that describe an amount or preparation, not the food: "große Zwiebeln, fein gehackt".
const NOISE = /\b(?:groß(?:e|er|es)?|klein(?:e|er|es)?|mittelgroß(?:e|er|es)?|frisch(?:e|er|es)?|fein|grob|gehackt(?:e)?|gewürfelt(?:e)?|geschnitten(?:e)?|gerieben(?:e)?|etwa|ca|zum|nach|belieben|optional)\b\.?/gi;

export function searchQueryFor(name: string): string {
  const cleaned = name
    .split(/[,(]/)[0]!
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned.length >= 2 ? cleaned : name.trim()).slice(0, 100);
}

export function dbFoodMatcher(prisma: PrismaClient, userId: string): FoodMatcher {
  return async (name) => {
    const q = searchQueryFor(name);
    if (q.length < 2) return [];
    return (await searchFoods(prisma, userId, q, MATCH_CANDIDATES)).map(toCandidate);
  };
}
