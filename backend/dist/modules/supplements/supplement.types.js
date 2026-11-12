import { supplementAnalysisSchema } from "@fitnesstracker/shared";
export function toSupplementDto(supplement) {
    const parsedAnalysis = supplement.aiAnalysis
        ? supplementAnalysisSchema.safeParse(supplement.aiAnalysis)
        : null;
    return {
        id: supplement.id,
        name: supplement.name,
        reminderTime: supplement.reminderTime,
        timeZone: supplement.timeZone,
        enabled: supplement.enabled,
        aiAnalysis: parsedAnalysis?.success ? parsedAnalysis.data : null,
    };
}
//# sourceMappingURL=supplement.types.js.map