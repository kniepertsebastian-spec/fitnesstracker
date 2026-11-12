import { MAX_ROTATIONS } from "./dailyChallenge.service.js";
export function toDailyChallengeItemDto(item) {
    return {
        id: item.id,
        exerciseId: item.exerciseId,
        exerciseName: item.exercise.nameDe ?? item.exercise.name,
        category: item.category,
        targetReps: item.targetReps,
        completedReps: item.completedReps,
        rotationsRemaining: Math.max(0, MAX_ROTATIONS - item.rotationsUsed),
    };
}
//# sourceMappingURL=dailyChallenge.types.js.map