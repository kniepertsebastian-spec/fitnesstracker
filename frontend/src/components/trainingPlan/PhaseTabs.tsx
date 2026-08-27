import type { TrainingPhase } from "@fitnesstracker/shared";
import { TRAINING_PHASES } from "@fitnesstracker/shared";
import { TRAINING_PHASE_LABELS } from "../../hooks/useTrainingPlan";

interface PhaseTabsProps {
  selected: TrainingPhase;
  onSelect: (phase: TrainingPhase) => void;
}

// Shared by /plan and /plan/generate — both drive a phase-scoped view (the exercise list, the AI
// generator) off the same three-way tab bar.
export function PhaseTabs({ selected, onSelect }: PhaseTabsProps) {
  return (
    <div className="mb-2 flex gap-1 rounded-lg border border-ink-800 bg-ink-900 p-1">
      {TRAINING_PHASES.map((phase) => (
        <button
          key={phase}
          onClick={() => onSelect(phase)}
          className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
            selected === phase ? "bg-violet-500 text-ink-950" : "text-ink-400 hover:text-ink-200"
          }`}
        >
          {TRAINING_PHASE_LABELS[phase]}
        </button>
      ))}
    </div>
  );
}
