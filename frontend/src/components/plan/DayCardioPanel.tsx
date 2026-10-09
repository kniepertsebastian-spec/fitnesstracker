import { useState } from "react";
import { Bike, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  CARDIO_MACHINE_LABELS,
  CARDIO_SLOT_LABELS,
  TRAINING_GOAL_LABELS,
  type CardioPlanItem,
  type TrainingPhase,
} from "@fitnesstracker/shared";
import { useCardioPlan, useResetCardioPlan, useSaveCardioPlanDay } from "../../hooks/useCardioPlan";
import { matchDay } from "../../lib/dayPlan";
import { Badge, Button, Callout, EmptyState, ListRow, Skeleton } from "../ui";
import { CardioEditDialog } from "./CardioEditDialog";

export function CardioItemRow({ item }: { item: CardioPlanItem }) {
  return (
    <ListRow value={`${item.durationMinutes} Min.`}>
      <div className="flex items-center gap-3 py-2">
        <Badge tone={item.slot === "WARMUP" ? "neutral" : "info"} className="w-[68px] shrink-0 justify-center">
          {CARDIO_SLOT_LABELS[item.slot]}
        </Badge>
        <div className="min-w-0">
          <p className="truncate">{CARDIO_MACHINE_LABELS[item.machine]}</p>
          <p className="truncate text-xs text-text-faint">{item.intensity}</p>
        </div>
      </div>
    </ListRow>
  );
}

export function DayCardioPanel({ phase, dayLabel }: { phase: TrainingPhase; dayLabel: string | null }) {
  const { data: plan, isLoading } = useCardioPlan(phase);
  const save = useSaveCardioPlanDay();
  const reset = useResetCardioPlan();
  const [editing, setEditing] = useState(false);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const day = matchDay(plan?.days, dayLabel);
  if (!plan || !day) {
    return <EmptyState icon={<Bike size={18} aria-hidden />} text="Für diesen Tag gibt es noch keinen Cardio-Plan." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Callout tone={plan.goal === null && day.source === "auto" ? "warning" : "info"}>{plan.reason}</Callout>

      {day.items.length === 0 ? (
        <p className="text-small text-text-subtle">
          {plan.goal === null && day.source === "auto"
            ? "Ohne Ziel bleibt das Training wie bisher nur Kraft. Eigene Einheiten kannst du trotzdem über „Anpassen“ planen."
            : "An diesem Tag ist kein Cardio geplant."}
        </p>
      ) : (
        <div>
          {day.items.map((item, i) => (
            <CardioItemRow key={i} item={item} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" iconLeft={<SlidersHorizontal size={16} aria-hidden />} onClick={() => setEditing(true)}>
          Anpassen
        </Button>
        {day.source === "custom" && (
          <>
            <Button
              variant="ghost"
              iconLeft={<RotateCcw size={16} aria-hidden />}
              disabled={reset.isPending}
              onClick={() => reset.mutate({ phase, dayLabel, scope: "day" })}
            >
              Auf Vorschlag zurücksetzen
            </Button>
            <Badge tone="violet">Eigene Version</Badge>
          </>
        )}
        {day.source === "auto" && plan.goal && <Badge tone="neutral">Vorschlag für {TRAINING_GOAL_LABELS[plan.goal]}</Badge>}
      </div>

      <CardioEditDialog
        open={editing}
        onOpenChange={setEditing}
        title="Cardio anpassen"
        description={day.isLegDay ? "Beintag: nach dem Training besser ohne Steigung oder Widerstand." : undefined}
        slots={["WARMUP", "AFTER"]}
        initial={day.items}
        saving={save.isPending}
        onSave={(items) =>
          save.mutateAsync({
            phase,
            dayLabel,
            items: items.map((i) => ({ ...i, slot: (i.slot === "WARMUP" ? "WARMUP" : "AFTER") as "WARMUP" | "AFTER" })),
          })
        }
      />
    </div>
  );
}
