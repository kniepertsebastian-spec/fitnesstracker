import type { ExerciseSourceAdapter, ImportedExercise } from "./types.js";

const DATASET_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// Public-domain (Unlicense) dataset of 800+ exercises: name, instructions, muscles, equipment,
// category, and reference images. No API key, no rate limit. It does not include video — that
// field stays empty for exercises imported from here.
interface RawExercise {
  id: string;
  name: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string | null;
  images?: string[];
}

export const freeExerciseDbAdapter: ExerciseSourceAdapter = {
  name: "free-exercise-db",

  async fetchExercises(): Promise<ImportedExercise[]> {
    const res = await fetch(DATASET_URL);
    if (!res.ok) {
      throw new Error(`free-exercise-db fetch failed: ${res.status} ${res.statusText}`);
    }
    const raw = (await res.json()) as RawExercise[];

    return raw.map((entry) => ({
      sourceId: entry.id,
      name: entry.name,
      description: entry.instructions?.length ? entry.instructions.join("\n\n") : undefined,
      imageUrls: (entry.images ?? []).map((path) => `${IMAGE_BASE_URL}${path}`),
      equipment: entry.equipment ?? undefined,
      category: entry.category ?? undefined,
      primaryMuscles: entry.primaryMuscles ?? [],
      secondaryMuscles: entry.secondaryMuscles ?? [],
    }));
  },
};
