import type { TrainingPhase } from "@fitnesstracker/shared";
import { TRAINING_PHASES } from "@fitnesstracker/shared";
import { TRAINING_PHASE_LABELS } from "../../hooks/useTrainingPlan";
import { SegmentedControl } from "../ui";

interface PhaseTabsProps {
  selected: TrainingPhase;
  onSelect: (phase: TrainingPhase) => void;
}

// Shared by /plan/generate — drives a phase-scoped view (the AI generator) off a three-way
// segmented control.
export function PhaseTabs({ selected, onSelect }: PhaseTabsProps) {
  return (
    <SegmentedControl
      label="Phase"
      value={selected}
      onChange={onSelect}
      options={TRAINING_PHASES.map((phase) => ({ value: phase, label: TRAINING_PHASE_LABELS[phase] }))}
    />
  );
}
