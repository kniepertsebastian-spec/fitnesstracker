import { useState } from "react";
import { Repeat2, RefreshCw, X } from "lucide-react";
import { PERIODIZATION_INFO, SET_SCHEME_INFO, TECHNIQUE_INFO, type PlanDraftDto, type PlanDraftItemDto } from "@fitnesstracker/shared";
import { TechniqueInfoButton } from "../training/TechniqueInfoButton";
import { Badge, Button, Callout } from "../ui";
import { ExerciseAlternatives } from "../training/ExerciseAlternatives";
import { formatPrescription } from "../../lib/planPrescription";

interface Props {
  draft: PlanDraftDto;
  busyDay: string | null;
  disabled: boolean;
  onRegenerateDay: (day: string) => void;
  // Swaps the exercise at `index` of draft.items for another one, nothing else is regenerated.
  onReplaceItem: (index: number, exerciseId: string) => Promise<unknown>;
  // Takes the technique off the exercise at `index` (and off the others of its group).
  onClearTechnique: (index: number) => void;
  onAccept: () => void;
  onDiscard: () => void;
}

// The generated plan before it replaces the live one: per day the exercises with their coaching
// details, a per-day "neu generieren", per exercise "Ersetzen" with direct alternatives, and
// accept/discard for the whole draft.
export function PlanDraftPreview({ draft, busyDay, disabled, onRegenerateDay, onReplaceItem, onClearTechnique, onAccept, onDiscard }: Props) {
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const days = draft.days.length > 0 ? draft.days : ["Plan"];
  const singleDay = days.length === 1;
  // Keeps each item's position in draft.items — the replace request addresses items by it.
  const itemsFor = (day: string) =>
    draft.items.map((item, index) => ({ item, index })).filter(({ item }) => (singleDay ? true : item.day === day));
  const filled = draft.items.filter((i) => i.filledByServer).length;

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="magenta">Entwurf</Badge>
        <span className="text-small text-text-subtle">Noch nicht übernommen – dein aktueller Plan bleibt bis dahin unverändert.</span>
      </div>

      {draft.rationale && (
        <Callout tone="info">
          <span className="font-medium">Warum dieser Plan: </span>
          {draft.rationale}
        </Callout>
      )}
      {draft.periodization && (
        <Callout tone="info">
          <span className="flex items-center gap-1 font-medium">
            Wochenverlauf: {PERIODIZATION_INFO[draft.periodization].label}
            <TechniqueInfoButton subject={{ kind: "periodization", id: draft.periodization }} />
          </span>
          <span className="block text-text-subtle">
            Gilt für diese Phase, sobald du den Plan übernimmst: {PERIODIZATION_INFO[draft.periodization].short}.
          </span>
        </Callout>
      )}
      {filled > 0 && (
        <p className="text-xs text-text-subtle">
          {filled} {filled === 1 ? "Übung wurde" : "Übungen wurden"} ergänzt, weil die KI zu wenige passende geliefert hat.
        </p>
      )}

      {days.map((day) => (
        <section key={day} className="rounded-xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="min-w-0 wrap-break-word text-body font-semibold text-text">{day}</h3>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              iconLeft={<RefreshCw size={14} aria-hidden className={busyDay === day ? "animate-spin" : undefined} />}
              disabled={disabled}
              onClick={() => onRegenerateDay(day)}
            >
              Neu
            </Button>
          </div>
          <ol className="flex flex-col divide-y divide-border">
            {itemsFor(day).map(({ item, index }, _i, dayItems) => (
              <DraftItem
                key={`${item.exerciseId}-${index}`}
                item={item}
                disabled={disabled}
                replacing={replacingIndex === index}
                dayExerciseIds={dayItems.map((d) => d.item.exerciseId)}
                partnerNames={
                  item.techniqueGroup
                    ? dayItems.filter((d) => d.index !== index && d.item.techniqueGroup === item.techniqueGroup).map((d) => d.item.exerciseName)
                    : []
                }
                onClearTechnique={() => onClearTechnique(index)}
                onToggleReplace={() => setReplacingIndex((current) => (current === index ? null : index))}
                onPick={async (exerciseId) => {
                  await onReplaceItem(index, exerciseId);
                  setReplacingIndex(null);
                }}
              />
            ))}
          </ol>
        </section>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" size="lg" fullWidth disabled={disabled} onClick={onAccept}>
          Plan übernehmen
        </Button>
        <Button variant="secondary" size="lg" fullWidth disabled={disabled} onClick={onDiscard}>
          Verwerfen
        </Button>
      </div>
    </div>
  );
}

interface DraftItemProps {
  item: PlanDraftItemDto;
  disabled: boolean;
  replacing: boolean;
  dayExerciseIds: string[];
  // Other exercises of the same technique group (superset partner, ...).
  partnerNames: string[];
  onClearTechnique: () => void;
  onToggleReplace: () => void;
  onPick: (exerciseId: string) => Promise<void>;
}

function DraftItem({ item, disabled, replacing, dayExerciseIds, partnerNames, onClearTechnique, onToggleReplace, onPick }: DraftItemProps) {
  return (
    <li className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="min-w-0 wrap-break-word text-body font-medium text-text">{item.exerciseName}</span>
          {item.filledByServer && <Badge tone="neutral">ergänzt</Badge>}
        </div>
        <Button
          variant={replacing ? "selected" : "ghost"}
          size="sm"
          className="shrink-0"
          iconLeft={<Repeat2 size={14} aria-hidden />}
          aria-expanded={replacing}
          aria-label={`${item.exerciseName} ersetzen`}
          disabled={disabled}
          onClick={onToggleReplace}
        >
          Ersetzen
        </Button>
      </div>
      <span className="tabular text-small text-text-muted">
        {formatPrescription(item)}
        {item.startWeightKg !== null && <> · Start {item.startWeightKg.toLocaleString("de-DE")} kg</>}
      </span>
      {(item.technique || item.setScheme) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
          {item.technique && (
            <>
              <Badge tone="magenta">{TECHNIQUE_INFO[item.technique].label}</Badge>
              <TechniqueInfoButton subject={{ kind: "technique", id: item.technique }} />
            </>
          )}
          {item.setScheme && item.setScheme !== "STRAIGHT" && (
            <>
              <Badge tone="info">{SET_SCHEME_INFO[item.setScheme].label}</Badge>
              <TechniqueInfoButton subject={{ kind: "scheme", id: item.setScheme }} />
            </>
          )}
          {partnerNames.length > 0 && <span className="text-xs text-text-subtle">zusammen mit {partnerNames.join(", ")}</span>}
          <Button variant="ghost" size="sm" iconLeft={<X size={14} aria-hidden />} disabled={disabled} onClick={onClearTechnique}>
            Weglassen
          </Button>
        </div>
      )}
      {item.setPlan && (
        <span className="tabular text-xs text-text-subtle">
          {item.setPlan.map((s) => (s.seconds ? `${s.seconds} s` : `${s.reps ?? "?"}${s.weightPct ? ` (${s.weightPct} %)` : ""}`)).join(" · ")}
        </span>
      )}
      {item.notes && <span className="text-small text-text-subtle">{item.notes}</span>}
      {item.alternativeExerciseName && (
        <span className="text-xs text-text-faint">Alternative: {item.alternativeExerciseName}</span>
      )}
      {replacing && (
        <div className="mt-2">
          <ExerciseAlternatives
            exerciseId={item.exerciseId}
            excludeIds={dayExerciseIds}
            disabled={disabled}
            onPick={(o) => void onPick(o.exerciseId)}
          />
        </div>
      )}
    </li>
  );
}
