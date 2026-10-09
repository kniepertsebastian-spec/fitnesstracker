import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { CARDIO_MACHINE_LABELS, type TrainingPhase } from "@fitnesstracker/shared";
import { useCardioPlan, useResetCardioPlan, useSaveCardioPlanFree } from "../../hooks/useCardioPlan";
import { Badge, Button, Card, ListRow, Skeleton } from "../ui";
import { CardioEditDialog } from "./CardioEditDialog";

// Sessions on days without strength training (e.g. intervals for fat loss or endurance). They
// have no fixed weekday — the plan does not know which days are free; logging one happens
// through "Cardio eintragen" on the Fortschritt page.
export function FreeCardioCard({ phase }: { phase: TrainingPhase }) {
  const { data: plan, isLoading } = useCardioPlan(phase);
  const save = useSaveCardioPlanFree();
  const reset = useResetCardioPlan();
  const [editing, setEditing] = useState(false);

  const items = plan?.free.items ?? [];

  return (
    <Card
      title="Cardio an freien Tagen"
      action={<span className="text-small text-text-subtle">{items.length > 0 ? `${items.length} pro Woche` : "keine"}</span>}
    >
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : items.length === 0 ? (
        <p className="text-small text-text-subtle">Für dein Ziel nicht nötig. Du kannst trotzdem eigene Einheiten planen.</p>
      ) : (
        <div>
          {items.map((item, i) => (
            <ListRow key={i} prefix={i + 1} value={`${item.durationMinutes} Min.`}>
              <p className="truncate">{CARDIO_MACHINE_LABELS[item.machine]}</p>
              <p className="truncate text-xs text-text-faint">{item.intensity}</p>
            </ListRow>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" iconLeft={<SlidersHorizontal size={14} aria-hidden />} onClick={() => setEditing(true)}>
          Anpassen
        </Button>
        {plan?.free.source === "custom" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<RotateCcw size={14} aria-hidden />}
              disabled={reset.isPending}
              onClick={() => reset.mutate({ phase, scope: "free" })}
            >
              Auf Vorschlag zurücksetzen
            </Button>
            <Badge tone="violet">Eigene Version</Badge>
          </>
        )}
      </div>
      <CardioEditDialog
        open={editing}
        onOpenChange={setEditing}
        title="Cardio an freien Tagen"
        slots={["FREE"]}
        initial={items}
        saving={save.isPending}
        onSave={(next) => save.mutateAsync({ phase, items: next.map((i) => ({ ...i, slot: "FREE" as const })) })}
      />
    </Card>
  );
}
