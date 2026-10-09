import { ChevronRight } from "lucide-react";
import { TRAINING_PHASE_ROTATION, type TrainingPhase } from "@fitnesstracker/shared";
import { TRAINING_PHASE_LABELS } from "../../hooks/useTrainingPlan";
import { PHASE_DOT, PHASE_RULES } from "../../lib/phaseInfo";
import { cn } from "../ui";

interface Props {
  current: TrainingPhase;
  selected: TrainingPhase;
  onSelect: (phase: TrainingPhase) => void;
}

// Aufbau → Muskelausdauer → Negativ. The tiles double as the phase picker for the exercise list
// below, so planning ahead for another phase is one tap.
export function PhaseRotation({ current, selected, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch" role="radiogroup" aria-label="Phase wählen">
      {TRAINING_PHASE_ROTATION.map((phase, i) => (
        <div key={phase} className="flex flex-1 items-center gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={selected === phase}
            onClick={() => onSelect(phase)}
            className={cn(
              "min-h-[72px] flex-1 rounded-xl border p-3 text-left transition-colors duration-150",
              selected === phase ? "border-accent-border bg-surface-2" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <span className="flex items-center gap-2">
              <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", PHASE_DOT[phase])} />
              <span className="text-body font-semibold text-text">{TRAINING_PHASE_LABELS[phase]}</span>
              {phase === current && <span className="text-xs text-text-subtle">· aktuell</span>}
            </span>
            <span className="mt-1 block text-small text-text-subtle">{PHASE_RULES[phase]}</span>
          </button>
          {i < TRAINING_PHASE_ROTATION.length - 1 && (
            <ChevronRight size={16} aria-hidden className="hidden shrink-0 text-text-faint lg:block" />
          )}
        </div>
      ))}
    </div>
  );
}
