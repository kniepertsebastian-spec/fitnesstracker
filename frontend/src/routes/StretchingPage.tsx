import { useState } from "react";
import { STRETCH_FOCUS_LABELS, type StretchFocusMuscle, type TrainingPhase } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { PageTabs } from "../components/layout/PageTabs";
import { PhaseTabs } from "../components/trainingPlan/PhaseTabs";
import { DailyStretchCard } from "../components/stretching/DailyStretchCard";
import { StretchList } from "../components/stretching/StretchList";
import { ApiError } from "../api/client";
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
    <div>
      <PhaseTabs selected={phase} onSelect={setSelected} />
      <p className="mb-3 text-xs text-ink-500">
        Zu jedem Trainingstag gibt es passende Dehnübungen für die belasteten Muskeln. Per KI lässt sich der
        Plan individuell erstellen (API-Key unter Einstellungen).
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
        >
          {generate.isPending ? "KI erstellt Dehnplan…" : "Dehnplan per KI erstellen"}
        </button>
        {hasAi && (
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-700 disabled:opacity-50"
          >
            Automatisch statt KI
          </button>
        )}
      </div>
      {generate.isError && (
        <p className="mb-3 text-sm text-red-400">
          {generate.error instanceof ApiError ? generate.error.message : "Dehnplan konnte nicht erstellt werden"}
        </p>
      )}

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : !data ? null : !data.catalogAvailable ? (
        <p className="text-sm text-ink-500">
          Keine Dehnübungen im Katalog. Importiere zuerst den Übungskatalog (Menü „Übungen“) — er enthält die
          Dehnübungen der free-exercise-db.
        </p>
      ) : data.days.length === 0 ? (
        <p className="text-sm text-ink-500">
          Für diese Phase gibt es noch keinen Trainingsplan. Lege unter „Plan“ Übungen an oder lass einen Plan
          generieren — danach erscheint hier der passende Dehnplan je Trainingstag.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.days.map((day) => (
            <div key={day.dayLabel ?? "all"} className="rounded-lg border border-ink-800 bg-ink-900 p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-200">{day.dayLabel ?? "Ganzkörper"}</p>
                <span className="shrink-0 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                  {day.source === "ai" ? "KI" : "Auto"}
                </span>
              </div>
              {day.muscles.length > 0 && (
                <p className="mb-3 text-xs text-ink-500">Trainiert: {musclesLabel(day.muscles)}</p>
              )}
              {day.items.length === 0 ? (
                <p className="text-sm text-ink-500">Keine passenden Dehnübungen gefunden.</p>
              ) : (
                <StretchList
                  items={day.items}
                  storageKey={`stretch-done:${new Date().toISOString().slice(0, 10)}:plan:${phase}:${day.dayLabel ?? ""}`}
                />
              )}
            </div>
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
      <h1 className="mb-4 text-xl font-semibold">Dehnen</h1>
      <PageTabs tabs={TABS} active={tab} onChange={(key) => setTab(key as typeof tab)} />
      {tab === "plan" ? <StretchPlanView /> : <DailyStretchCard />}
    </AppShell>
  );
}
