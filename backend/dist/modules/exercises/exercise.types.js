import { toLocalImageUrls } from "../exerciseImages/exerciseImage.js";
export function toExerciseDto(exercise) {
    return {
        id: exercise.id,
        name: exercise.nameDe ?? exercise.name,
        description: exercise.description,
        videoUrl: exercise.videoUrl,
        imageUrls: toLocalImageUrls(exercise.imageUrls),
        equipment: exercise.equipment,
        category: exercise.category,
        primaryMuscles: exercise.primaryMuscles,
        secondaryMuscles: exercise.secondaryMuscles,
        source: exercise.source,
        isActive: exercise.isActive,
    };
}
//# sourceMappingURL=exercise.types.js.map