import { TRAINING_PHASE_ROTATION, type TrainingPhase } from "@fitnesstracker/shared";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../../hooks/useTrainingPlan";
import { SegmentedControl } from "../ui";

interface PhaseTabsProps {
  selected: TrainingPhase;
  onSelect: (phase: TrainingPhase) => void;
}

// Shared by /plan/generate — drives a phase-scoped view (the AI generator) off the user's
// configured phases (including custom phases and Daily if created).
export function PhaseTabs({ selected, onSelect }: PhaseTabsProps) {
  const { data: plan } = useTrainingPlan();
  const options =
    plan?.phases && plan.phases.length > 0
      ? plan.phases.map((p) => ({ value: p.phase, label: p.label }))
      : TRAINING_PHASE_ROTATION.map((phase) => ({ value: phase, label: TRAINING_PHASE_LABELS[phase] }));

  return (
    <SegmentedControl
      label="Phase"
      value={selected}
      onChange={onSelect}
      options={options}
    />
  );
}
