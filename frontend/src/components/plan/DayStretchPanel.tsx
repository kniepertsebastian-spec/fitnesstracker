import { Activity } from "lucide-react";
import { STRETCH_FOCUS_LABELS, type StretchFocusMuscle, type TrainingPhase } from "@fitnesstracker/shared";
import { useStretchPlan } from "../../hooks/useStretching";
import { formatHold, matchDay } from "../../lib/dayPlan";
import { Badge, ButtonLink, EmptyState, ListRow, Skeleton } from "../ui";

export function DayStretchPanel({ phase, dayLabel }: { phase: TrainingPhase; dayLabel: string | null }) {
  const { data, isLoading } = useStretchPlan(phase);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (data && !data.catalogAvailable) {
    return (
      <EmptyState
        icon={<Activity size={18} aria-hidden />}
        text="Keine Dehnübungen im Katalog. Importiere zuerst den Übungskatalog unter „Übungen“."
      />
    );
  }
  const day = matchDay(data?.days, dayLabel);
  if (!day || day.items.length === 0) {
    return <EmptyState icon={<Activity size={18} aria-hidden />} text="Für diesen Tag gibt es keine passenden Dehnübungen." />;
  }

  const muscles = day.muscles
    .slice(0, 4)
    .map((m) => STRETCH_FOCUS_LABELS[m as StretchFocusMuscle] ?? m)
    .join(", ");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-text-subtle">
        Nach dem Training, für die trainierten Muskeln{muscles ? `: ${muscles}` : ""}.
      </p>
      <div>
        {day.items.map((item) => (
          <ListRow key={item.exerciseId} value={`${item.sets > 1 ? `${item.sets} × ` : ""}${formatHold(item.holdSeconds)}`}>
            {item.name}
          </ListRow>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink to="/stretching" variant="secondary">
          Dehnplan bearbeiten
        </ButtonLink>
        <Badge tone={day.source === "ai" ? "violet" : "neutral"}>{day.source === "ai" ? "Von der KI" : "Automatisch"}</Badge>
      </div>
    </div>
  );
}
