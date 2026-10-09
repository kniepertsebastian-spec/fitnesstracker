import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, MessageSquareText, MoreHorizontal, Sparkles } from "lucide-react";
import type { TrainingPhase } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { FreeCardioCard } from "../components/plan/FreeCardioCard";
import { PhaseHero } from "../components/plan/PhaseHero";
import { PhaseRotation } from "../components/plan/PhaseRotation";
import { PlanDays } from "../components/plan/PlanDays";
import { RecommendedSplitsSection } from "../components/trainingPlan/RecommendedSplitsSection";
import { TrainingPlanRemarksCard } from "../components/trainingPlan/TrainingPlanRemarksCard";
import {
  Badge,
  Card,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  ListRow,
  Skeleton,
} from "../components/ui";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../hooks/useTrainingPlan";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function TrainingPlanPage() {
  const { data: plan, isLoading } = useTrainingPlan();
  const [selectedPhase, setSelectedPhase] = useState<TrainingPhase | null>(null);
  const [remarksOpen, setRemarksOpen] = useState(false);

  // Default the phase picker to the active phase once the plan has loaded — but only the first
  // time, so switching to plan ahead isn't reset by a background refetch.
  useEffect(() => {
    if (plan && selectedPhase === null) setSelectedPhase(plan.currentPhase);
  }, [plan, selectedPhase]);

  return (
    <AppShell>
      <div className="mb-5 flex items-start justify-between gap-3">
        <h1 className="text-h1 text-text lg:text-h1-lg">Trainingsplan</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label="Weitere Aktionen">
              <MoreHorizontal size={20} aria-hidden />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link to="/plan/generate" className="flex w-full items-center gap-2">
                <FileDown size={16} aria-hidden className="text-text-subtle" />
                Export &amp; Import
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem icon={<MessageSquareText size={16} aria-hidden />} onSelect={() => setRemarksOpen(true)}>
              Bemerkungen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !plan ? (
        <Card>
          <EmptyState icon={<MoreHorizontal size={18} aria-hidden />} text="Kein Plan gefunden." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <PhaseHero plan={plan} />

          {selectedPhase && (
            <PhaseRotation current={plan.currentPhase} selected={selectedPhase} onSelect={setSelectedPhase} />
          )}

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
            {selectedPhase && <PlanDays phase={selectedPhase} />}

            <div className="flex flex-col gap-4">
              {selectedPhase && <FreeCardioCard phase={selectedPhase} />}

              <Link
                to="/plan/generate"
                className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors duration-150 hover:bg-surface-2"
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-soft text-violet">
                  <Sparkles size={18} />
                </span>
                <span className="min-w-0 flex-1 text-body font-medium text-text">Nächste Phase mit KI planen</span>
                <Badge tone="violet">Eigener Schlüssel</Badge>
              </Link>

              <Card title="Verlauf">
                {plan.history.length === 0 ? (
                  <p className="text-small text-text-faint">Noch kein Phasenwechsel.</p>
                ) : (
                  plan.history.map((entry) => (
                    <ListRow key={entry.id} value={`${formatDate(entry.startedOn)} – ${entry.endedOn ? formatDate(entry.endedOn) : "…"}`}>
                      {TRAINING_PHASE_LABELS[entry.phase]}
                    </ListRow>
                  ))
                )}
              </Card>
            </div>
          </div>

          <RecommendedSplitsSection />

          <Dialog open={remarksOpen} onOpenChange={setRemarksOpen} title="Bemerkungen">
            <TrainingPlanRemarksCard plan={plan} onSaved={() => setRemarksOpen(false)} />
          </Dialog>
        </div>
      )}
    </AppShell>
  );
}

