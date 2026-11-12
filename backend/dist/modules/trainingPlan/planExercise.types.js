// Every query feeding toPlanExerciseDto includes both relations, so the alternative's name is
// available without a second lookup.
export const planExerciseInclude = { exercise: true, alternativeExercise: true };
export function toPlanExerciseDto(entry) {
    const alternative = entry.alternativeExercise ?? null;
    return {
        id: entry.id,
        phase: entry.phase,
        exerciseId: entry.exerciseId,
        exerciseName: entry.exercise.nameDe ?? entry.exercise.name,
        targetSets: entry.targetSets,
        targetReps: entry.targetReps,
        order: entry.order,
        dayLabel: entry.dayLabel,
        repRangeMin: entry.repRangeMin,
        repRangeMax: entry.repRangeMax,
        targetRir: entry.targetRir,
        restSeconds: entry.restSeconds,
        notes: entry.notes,
        startWeightKg: entry.startWeightKg === null ? null : Number(entry.startWeightKg),
        alternativeExerciseId: entry.alternativeExerciseId,
        alternativeExerciseName: alternative ? (alternative.nameDe ?? alternative.name) : null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
    };
}
//# sourceMappingURL=planExercise.types.js.map