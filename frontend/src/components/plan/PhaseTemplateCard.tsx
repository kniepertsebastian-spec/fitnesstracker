import { useState } from "react";
import { LayoutTemplate } from "lucide-react";
import {
  PHASE_TEMPLATES,
  TRAINING_GOAL_LABELS,
  phaseTemplateWeeks,
  type TrainingGoalValue,
  type TrainingPlanDto,
} from "@fitnesstracker/shared";
import { ApiError } from "../../api/client";
import { useApplyPhaseTemplate } from "../../hooks/useTrainingPlan";
import { Button, Callout, Card, Dialog, Disclosure } from "../ui";

const DISMISSED_KEY = "phase-template-dismissed";

function loadDismissed(): TrainingGoalValue[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? (raw as TrainingGoalValue[]) : [];
  } catch {
    return [];
  }
}

function saveDismissed(goals: TrainingGoalValue[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(goals));
  } catch {
    // not remembered, the proposal simply shows again next time
  }
}

// Is the plan already laid out like the template? Then there is nothing to propose.
function matchesTemplate(plan: TrainingPlanDto, goal: TrainingGoalValue): boolean {
  const labels = PHASE_TEMPLATES[goal].phases.map((p) => p.label);
  const mine = plan.phases.filter((p) => !p.isDaily).map((p) => p.label);
  return labels.length === mine.length && labels.every((l, i) => l === mine[i]);
}

// A proposal for the order of training phases that fits the chosen goal. It creates the phases empty;
// declining changes nothing, and the phases stay editable afterwards.
export function PhaseTemplateCard({ plan }: { plan: TrainingPlanDto }) {
  const goal = plan.trainingGoal;
  const apply = useApplyPhaseTemplate();
  const [dismissed, setDismissed] = useState<TrainingGoalValue[]>(loadDismissed);
  const [reopened, setReopened] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!goal || matchesTemplate(plan, goal)) return null;
  const template = PHASE_TEMPLATES[goal];
  const hidden = dismissed.includes(goal) && !reopened;

  const dismiss = () => {
    const next = [...new Set([...dismissed, goal])];
    setDismissed(next);
    saveDismissed(next);
    setReopened(false);
  };

  const run = (clearExisting: boolean) =>
    apply.mutate(
      { goal, clearExisting },
      {
        onSuccess: () => setConfirmClear(false),
        onError: (error) => {
          // 409: phases still hold exercises — ask before deleting them.
          if (error instanceof ApiError && error.status === 409 && !clearExisting) setConfirmClear(true);
        },
      },
    );

  if (hidden) {
    return (
      <div>
        <Button variant="ghost" size="sm" iconLeft={<LayoutTemplate size={16} aria-hidden />} onClick={() => setReopened(true)}>
          Phasenvorlage für „{TRAINING_GOAL_LABELS[goal]}“ ansehen
        </Button>
      </div>
    );
  }

  const total = phaseTemplateWeeks(goal);
  const conflictMessage = apply.error instanceof ApiError && apply.error.status === 409 ? apply.error.message : null;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <LayoutTemplate size={16} aria-hidden className="text-accent-text" /> Phasenvorlage: {TRAINING_GOAL_LABELS[goal]}
        </span>
      }
    >
      <p className="text-small text-text-subtle">
        Ein Vorschlag, wie sich Phasen für dieses Ziel sinnvoll abwechseln — {total} Wochen insgesamt. Die Phasen
        werden leer angelegt; den Plan dazu erstellst du per KI oder selbst. Du kannst alles danach ändern.
      </p>

      <div className="mt-3 flex h-3 w-full gap-1" role="img" aria-label={`${template.phases.length} Phasen, ${total} Wochen`}>
        {template.phases.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            title={`${p.label}: ${p.weeks} Wochen`}
            style={{ flexGrow: p.weeks, flexBasis: 0 }}
            className={p.style === "DELOAD" ? "rounded-full bg-info" : p.style === "STRENGTH" ? "rounded-full bg-warning" : "rounded-full bg-accent"}
          />
        ))}
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {template.phases.map((p, i) => (
          <li key={`${p.label}-${i}`} className="text-small">
            <span className="font-medium text-text">
              {i + 1}. {p.label}
            </span>{" "}
            <span className="tabular font-numeric text-text-subtle">
              · {p.weeks} {p.weeks === 1 ? "Woche" : "Wochen"}
            </span>
            <span className="block text-text-subtle">{p.focus}</span>
          </li>
        ))}
      </ol>

      <Disclosure title="Warum diese Reihenfolge?" className="mt-3 border-border-subtle bg-transparent">
        <p className="text-small text-text-2">{template.rationale}</p>
        <p className="text-xs text-text-faint">
          Allgemeine Trainingsprinzipien (Periodisierung, Deloads), keine individuelle Beratung. Wenn du verletzt
          bist oder Beschwerden hast, passe die Dauer an oder sprich mit einer Fachperson.
        </p>
      </Disclosure>

      {apply.isError && !confirmClear && !conflictMessage && (
        <Callout tone="danger" className="mt-3">
          Die Vorlage konnte nicht übernommen werden. Plan-Änderungen brauchen eine Verbindung.
        </Callout>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={apply.isPending} onClick={() => run(false)}>
          {apply.isPending ? "Legt an…" : "Vorlage übernehmen"}
        </Button>
        <Button variant="ghost" disabled={apply.isPending} onClick={dismiss}>
          Nicht jetzt
        </Button>
      </div>

      <Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Bestehende Übungen löschen?"
        description={conflictMessage ?? "In deinen Phasen liegen noch Übungen."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" disabled={apply.isPending} onClick={() => run(true)}>
              Löschen und Vorlage anlegen
            </Button>
          </>
        }
      >
        <p className="text-small text-text-2">
          Die Vorlage legt leere Phasen an. Die Übungen, Cardio- und Dehn-Einträge deiner bisherigen Phasen werden
          dabei gelöscht, dein Trainingsverlauf (Sätze) bleibt erhalten. Tipp: Sichere den Plan vorher unter
          „Export &amp; Import“.
        </p>
      </Dialog>
    </Card>
  );
}
