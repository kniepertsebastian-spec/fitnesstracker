// One record as normalized from an external source, before it's written to the DB.
export interface ImportedExercise {
  sourceId: string;
  name: string;
  description?: string;
  videoUrl?: string;
  imageUrls: string[];
  equipment?: string;
  category?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

// Implement this once per external exercise database to make it importable. Register the
// adapter in `sources/index.ts` — the import endpoint takes the adapter's `name` as the
// `source` request field, so adding a new provider never touches route/service code.
export interface ExerciseSourceAdapter {
  name: string;
  fetchExercises(): Promise<ImportedExercise[]>;
}
