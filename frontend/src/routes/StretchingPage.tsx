import { useState } from "react";
import { STRETCH_FOCUS_LABELS, type StretchFocusMuscle, type TrainingPhase } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { PageTabs } from "../components/layout/PageTabs";
import { PhaseTabs } from "../components/trainingPlan/PhaseTabs";
import { StretchCard } from "../components/daily/StretchCard";
import { StretchList } from "../components/stretching/StretchList";
import { ApiError } from "../api/client";
import { Badge, Button, Callout, Card, EmptyState, Skeleton } from "../components/ui";
import { Activity } from "lucide-react";
import { useTrainingPlan } from "../hooks/useTrainingPlan";
import { useGenerateStretchPlan, useResetStretchPlan, useStretchPlan } from "../hooks/useStretching";

const TABS = [
  { key: "plan", label: "Dehnplan" },
  { key: "daily", label: "Heute" },
] as const;

function musclesLabel(muscles: string[]): string {
  return muscles
    .slice(0, 4)
    .map((m) => STRETCH_FOCUS_LABELS[m as StretchFocusMuscle] ?? m)
    .join(", ");
}

function StretchPlanView() {
  const { data: trainingPlan } = useTrainingPlan();
  const [selected, setSelected] = useState<TrainingPhase | null>(null);
  const phase = selected ?? trainingPlan?.currentPhase ?? "AUFBAU";
  const { data, isLoading } = useStretchPlan(phase);
  const generate = useGenerateStretchPlan(phase);
  const reset = useResetStretchPlan(phase);

  const hasAi = data?.days.some((d) => d.source === "ai") ?? false;

  return (
    <div className="flex flex-col gap-4">
      <PhaseTabs selected={phase} onSelect={setSelected} />
      <p className="text-small text-text-subtle">
        Zu jedem Trainingstag gibt es passende Dehnübungen für die belasteten Muskeln. Per KI lässt sich der
        Plan individuell erstellen (API-Key unter Einstellungen).
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={generate.isPending} onClick={() => generate.mutate()}>
          {generate.isPending ? "KI erstellt Dehnplan…" : "Dehnplan per KI erstellen"}
        </Button>
        {hasAi && (
          <Button variant="secondary" disabled={reset.isPending} onClick={() => reset.mutate()}>
            Automatisch statt KI
          </Button>
        )}
      </div>
      {generate.isError && (
        <Callout tone="danger">
          {generate.error instanceof ApiError ? generate.error.message : "Dehnplan konnte nicht erstellt werden"}
        </Callout>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data ? null : !data.catalogAvailable ? (
        <Card>
          <EmptyState
            icon={<Activity size={18} aria-hidden />}
            text="Keine Dehnübungen im Katalog. Importiere zuerst den Übungskatalog (Menü „Übungen“) — er enthält die Dehnübungen der free-exercise-db."
          />
        </Card>
      ) : data.days.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Activity size={18} aria-hidden />}
            text="Für diese Phase gibt es noch keinen Trainingsplan. Lege unter „Plan“ Übungen an oder lass einen Plan generieren — danach erscheint hier der passende Dehnplan je Trainingstag."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          {data.days.map((day) => (
            <Card
              key={day.dayLabel ?? "all"}
              title={day.dayLabel ?? "Ganzkörper"}
              action={<Badge tone={day.source === "ai" ? "violet" : "neutral"}>{day.source === "ai" ? "KI" : "Auto"}</Badge>}
            >
              {day.muscles.length > 0 && (
                <p className="mb-3 text-small text-text-faint">Trainiert: {musclesLabel(day.muscles)}</p>
              )}
              {day.items.length === 0 ? (
                <p className="text-small text-text-subtle">Keine passenden Dehnübungen gefunden.</p>
              ) : (
                <StretchList
                  items={day.items}
                  storageKey={`stretch-done:${new Date().toISOString().slice(0, 10)}:plan:${phase}:${day.dayLabel ?? ""}`}
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function StretchingPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("plan");

  return (
    <AppShell>
      <h1 className="mb-4 text-h1 text-text lg:text-h1-lg">Dehnen</h1>
      <PageTabs tabs={TABS} active={tab} onChange={(key) => setTab(key as typeof tab)} />
      {tab === "plan" ? <StretchPlanView /> : <StretchCard />}
    </AppShell>
  );
}
