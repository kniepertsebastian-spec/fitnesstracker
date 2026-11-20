import type { ExerciseDto } from "@fitnesstracker/shared";
import { equipmentLabel, muscleLabel } from "./exerciseLabels";

// Search over the local copy of the catalog: German and English names, muscles and equipment in both
// languages, ignoring case, umlauts and punctuation. So "deadlift", "kreuzheben" and "Kreuzheben (Langhantel)"
// all find the same exercise, with or without a connection.

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchTerms(query: string): string[] {
  return normalizeSearch(query).split(" ").filter(Boolean);
}

// Everything a query may match, normalized once per exercise.
const haystacks = new WeakMap<ExerciseDto, string>();

function haystackOf(e: ExerciseDto): string {
  const cached = haystacks.get(e);
  if (cached !== undefined) return cached;
  const parts = [
    e.name,
    e.nameEn ?? "",
    e.equipment ?? "",
    e.equipment ? equipmentLabel(e.equipment) : "",
    ...e.primaryMuscles.flatMap((m) => [m, muscleLabel(m)]),
    ...e.secondaryMuscles.flatMap((m) => [m, muscleLabel(m)]),
  ];
  const value = normalizeSearch(parts.join(" "));
  haystacks.set(e, value);
  return value;
}

// Every term must appear (in any order); names beat muscles and equipment in the ranking, and a name that
// starts with the query comes first.
export function matchScore(e: ExerciseDto, terms: string[]): number | null {
  if (terms.length === 0) return 0;
  const hay = haystackOf(e);
  if (!terms.every((t) => hay.includes(t))) return null;
  const names = normalizeSearch(`${e.name} ${e.nameEn ?? ""}`);
  let score = 0;
  for (const t of terms) {
    if (names.includes(t)) score += 2;
    if (names.startsWith(t) || names.includes(` ${t}`)) score += 1;
  }
  return score;
}

export interface CatalogFilters {
  search?: string;
  muscleGroup?: string;
  equipment?: string;
  includeInactive?: boolean;
}

export function filterCatalog(items: ExerciseDto[], filters: CatalogFilters): ExerciseDto[] {
  const terms = searchTerms(filters.search ?? "");
  const ranked: Array<{ e: ExerciseDto; score: number; index: number }> = [];
  items.forEach((e, index) => {
    if (!filters.includeInactive && !e.isActive) return;
    if (filters.muscleGroup && !e.primaryMuscles.includes(filters.muscleGroup) && !e.secondaryMuscles.includes(filters.muscleGroup)) return;
    if (filters.equipment && (e.equipment ?? "").toLowerCase() !== filters.equipment.toLowerCase()) return;
    const score = matchScore(e, terms);
    if (score !== null) ranked.push({ e, score, index });
  });
  // Without a query the catalog keeps its own order (German name); with one, the best match first.
  if (terms.length > 0) ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.map((r) => r.e);
}

// Muscles and equipment present in the catalog, for the filter pills.
export function catalogFacets(items: ExerciseDto[]): { muscleGroups: string[]; equipment: string[] } {
  const muscles = new Set<string>();
  const equipment = new Set<string>();
  for (const e of items) {
    for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) muscles.add(m);
    if (e.equipment) equipment.add(e.equipment);
  }
  return { muscleGroups: [...muscles].sort(), equipment: [...equipment].sort() };
}
