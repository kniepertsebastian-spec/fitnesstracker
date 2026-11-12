import { phaseConfigItemSchema, TRAINING_PHASE_LABELS, TRAINING_PHASE_ROTATION, } from "@fitnesstracker/shared";
import { z } from "zod";
const phaseConfigArraySchema = z.array(phaseConfigItemSchema);
export function getDefaultPhaseConfigs() {
    return TRAINING_PHASE_ROTATION.map((phase) => ({
        phase,
        label: TRAINING_PHASE_LABELS[phase],
        isDaily: false,
    }));
}
export function resolvePhaseConfigs(raw) {
    const parsed = phaseConfigArraySchema.safeParse(raw);
    if (parsed.success && parsed.data.length > 0) {
        return parsed.data;
    }
    return getDefaultPhaseConfigs();
}
export function getRotationalPhases(configs) {
    const rotational = configs.filter((c) => !c.isDaily).map((c) => c.phase);
    return rotational.length > 0 ? rotational : [...TRAINING_PHASE_ROTATION];
}
export function getPhaseLabel(configs, phase) {
    const found = configs.find((c) => c.phase === phase);
    return found?.label ?? TRAINING_PHASE_LABELS[phase] ?? phase;
}
export function toTrainingPlanDto(plan, nextRotationOn, history) {
    const phases = resolvePhaseConfigs(plan.phaseConfigs);
    return {
        currentPhase: plan.currentPhase,
        phaseStartedOn: plan.phaseStartedOn.toISOString(),
        nextRotationOn: nextRotationOn ? nextRotationOn.toISOString() : null,
        extensionWeeks: plan.extensionWeeks,
        trainingGoal: plan.trainingGoal,
        pausedAt: plan.pausedAt ? plan.pausedAt.toISOString() : null,
        remarks: plan.remarks,
        detectedAsymmetries: plan.detectedAsymmetries,
        asymmetryAnalyzedAt: plan.asymmetryAnalyzedAt ? plan.asymmetryAnalyzedAt.toISOString() : null,
        phases,
        history: history.map((entry) => ({
            id: entry.id,
            phase: entry.phase,
            startedOn: entry.startedOn.toISOString(),
            endedOn: entry.endedOn ? entry.endedOn.toISOString() : null,
        })),
    };
}
//# sourceMappingURL=trainingPlan.types.js.map