export function toGoalDto(goal, currentValue) {
    return {
        id: goal.id,
        type: goal.type,
        exerciseId: goal.exerciseId,
        exerciseName: goal.exercise ? (goal.exercise.nameDe ?? goal.exercise.name) : null,
        // Prisma.Decimal doesn't serialize to a plain JSON number on its own — convert explicitly.
        targetValue: Number(goal.targetValue),
        targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
        achievedAt: goal.achievedAt ? goal.achievedAt.toISOString() : null,
        currentValue,
        createdAt: goal.createdAt.toISOString(),
        updatedAt: goal.updatedAt.toISOString(),
    };
}
export function toGoalSuggestionDto(suggestion) {
    return {
        exerciseId: suggestion.exerciseId,
        exerciseName: suggestion.exerciseName,
        type: suggestion.type,
        currentBestValue: suggestion.currentBestValue,
        plateauDetected: suggestion.plateauDetected,
        tiers: {
            conservative: {
                targetValue: suggestion.tiers.conservative.targetValue,
                targetDate: suggestion.tiers.conservative.targetDate.toISOString(),
            },
            realistic: {
                targetValue: suggestion.tiers.realistic.targetValue,
                targetDate: suggestion.tiers.realistic.targetDate.toISOString(),
            },
            ambitious: {
                targetValue: suggestion.tiers.ambitious.targetValue,
                targetDate: suggestion.tiers.ambitious.targetDate.toISOString(),
            },
        },
    };
}
//# sourceMappingURL=goal.types.js.map