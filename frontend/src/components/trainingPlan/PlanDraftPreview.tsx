import { RefreshCw } from "lucide-react";
import type { PlanDraftDto, PlanDraftItemDto } from "@fitnesstracker/shared";
import { Badge, Button, Callout } from "../ui";
import { formatPrescription } from "../../lib/planPrescription";

interface Props {
  draft: PlanDraftDto;
  busyDay: string | null;
  disabled: boolean;
  onRegenerateDay: (day: string) => void;
  onAccept: () => void;
  onDiscard: () => void;
}

// The generated plan before it replaces the live one: per day the exercises with their coaching
// details, a per-day "neu generieren", and accept/discard for the whole draft.
export function PlanDraftPreview({ draft, busyDay, disabled, onRegenerateDay, onAccept, onDiscard }: Props) {
  const days = draft.days.length > 0 ? draft.days : ["Plan"];
  const singleDay = days.length === 1;
  const itemsFor = (day: string) => draft.items.filter((i) => (singleDay ? true : i.day === day));
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
      {filled > 0 && (
        <p className="text-xs text-text-subtle">
          {filled} {filled === 1 ? "Übung wurde" : "Übungen wurden"} ergänzt, weil die KI zu wenige passende geliefert hat.
        </p>
      )}

      {days.map((day) => (
        <section key={day} className="rounded-xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="min-w-0 break-words text-body font-semibold text-text">{day}</h3>
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
            {itemsFor(day).map((item, index) => (
              <DraftItem key={`${item.exerciseId}-${index}`} item={item} />
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

function DraftItem({ item }: { item: PlanDraftItemDto }) {
  return (
    <li className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="min-w-0 break-words text-body font-medium text-text">{item.exerciseName}</span>
        {item.filledByServer && <Badge tone="neutral">ergänzt</Badge>}
      </div>
      <span className="tabular text-small text-text-muted">
        {formatPrescription(item)}
        {item.startWeightKg !== null && <> · Start {item.startWeightKg.toLocaleString("de-DE")} kg</>}
      </span>
      {item.notes && <span className="text-small text-text-subtle">{item.notes}</span>}
      {item.alternativeExerciseName && (
        <span className="text-xs text-text-faint">Alternative: {item.alternativeExerciseName}</span>
      )}
    </li>
  );
}
