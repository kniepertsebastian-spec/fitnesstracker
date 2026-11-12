const DATASET_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const IMAGE_BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
export const freeExerciseDbAdapter = {
    name: "free-exercise-db",
    async fetchExercises() {
        const res = await fetch(DATASET_URL);
        if (!res.ok) {
            throw new Error(`free-exercise-db fetch failed: ${res.status} ${res.statusText}`);
        }
        const raw = (await res.json());
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
//# sourceMappingURL=freeExerciseDb.adapter.js.map