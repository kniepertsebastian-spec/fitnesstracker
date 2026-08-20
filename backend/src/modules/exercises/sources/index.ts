import type { ExerciseSourceAdapter } from "./types.js";
import { freeExerciseDbAdapter } from "./freeExerciseDb.adapter.js";

export type { ExerciseSourceAdapter, ImportedExercise } from "./types.js";

// Add new adapters here as they're built — this list is the single place that wires a new
// source into the import endpoint.
const adapters: ExerciseSourceAdapter[] = [freeExerciseDbAdapter];

export function getSourceAdapter(name: string): ExerciseSourceAdapter | undefined {
  return adapters.find((adapter) => adapter.name === name);
}

export function listSourceNames(): string[] {
  return adapters.map((adapter) => adapter.name);
}
