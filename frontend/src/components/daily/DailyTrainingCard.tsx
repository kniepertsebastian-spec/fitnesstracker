import { Check } from "lucide-react";
import { useOpenWorkoutSession } from "../../hooks/useWorkoutSession";
import { useWeeklyPlanStatus } from "../../hooks/usePlanExercises";
import { useTrainingPlan } from "../../hooks/useTrainingPlan";
import { Badge, ButtonLink, Card, ProgressBar, Skeleton } from "../ui";

// The Daily phase of the plan, done in pieces over the day. It has its own session (separate from the
// regular workout), so one exercise can be done, the session paused, and the rest picked up later —
// the focus mode of a workout is left alone.
export function DailyTrainingCard() {
  const { data: plan } = useTrainingPlan();
  const dailyConfig = plan?.phases?.find((p) => p.isDaily || p.phase === "DAILY") ?? null;
  const { data: status, isLoading } = useWeeklyPlanStatus("DAILY", { enabled: !!dailyConfig });
  const { data: session } = useOpenWorkoutSession("DAILY");

  if (!dailyConfig) return null;
  if (isLoading) {
    return (
      <Card title={dailyConfig.label}>
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  // For the Daily phase "logged this week" means logged today (see planWeekStatus.service.ts).
  const exercises = status?.days.flatMap((d) => d.exercises) ?? [];
  const unique = [...new Map(exercises.map((e) => [e.exerciseId, e])).values()];
  if (unique.length === 0) return null;
  const done = unique.filter((e) => e.loggedThisWeek).length;
  const allDone = done === unique.length;

  return (
    <Card
      title={dailyConfig.label}
      action={
        session?.status === "PAUSED" ? <Badge tone="warning">pausiert</Badge> : session ? <Badge tone="accent">läuft</Badge> : undefined
      }
    >
      <p className="text-small text-text-subtle">
        Heute {done} von {unique.length} erledigt. Du kannst zwischendurch einzelne Übungen machen und pausieren —
        dein normales Training bleibt davon unberührt.
      </p>
      <ProgressBar className="mt-3" value={(done / unique.length) * 100} size={6} label={`Daily: ${done} von ${unique.length}`} />
      <ul className="mt-3 flex flex-col gap-1.5">
        {unique.map((e) => (
          <li key={e.exerciseId} className="flex items-center gap-2 text-small">
            <span
              aria-hidden
              className={
                e.loggedThisWeek
                  ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
                  : "h-5 w-5 shrink-0 rounded-full border border-border-strong"
              }
            >
              {e.loggedThisWeek && <Check size={12} strokeWidth={3} />}
            </span>
            <span className={e.loggedThisWeek ? "text-text-subtle line-through" : "text-text-2"}>{e.exerciseName}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <ButtonLink to={session ? "/training?mode=daily" : "/training?mode=daily&start=1"} variant={allDone ? "secondary" : "primary"} size="lg">
          {session ? "Daily fortsetzen" : allDone ? "Nochmal starten" : "Daily starten"}
        </ButtonLink>
      </div>
    </Card>
  );
}
