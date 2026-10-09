import { useMemo } from "react";
import { AppShell } from "../components/layout/AppShell";
import { GoalTile } from "../components/dashboard/GoalTile";
import { HeroCard } from "../components/dashboard/HeroCard";
import { LastWorkoutTile, RecentWorkoutsTable, lastWorkoutDays } from "../components/dashboard/RecentWorkouts";
import { TodayChecklist } from "../components/dashboard/TodayChecklist";
import type { ChecklistRow } from "../components/dashboard/TodayChecklist";
import { WeekCard } from "../components/dashboard/WeekCard";
import { Skeleton, StatTile } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useBodyCompositionEntries } from "../hooks/useBodyComposition";
import { useDailyChallenge } from "../hooks/useDailyChallenge";
import { useWeeklyPlanStatus } from "../hooks/usePlanExercises";
import { useDailyStretchStatus } from "../hooks/useStretching";
import { useSupplements } from "../hooks/useSupplements";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../hooks/useTrainingPlan";
import { useWorkoutLogs } from "../hooks/useWorkoutLogs";
import { useOpenWorkoutSession } from "../hooks/useWorkoutSession";
import { currentWeekDayKeys, utcDayKey } from "../lib/dates";
import { phaseLength, phaseWeek } from "../lib/phase";
import {
  daysAgo,
  formatDelta,
  mondayOf,
  recordsBetween,
  trainedDaysBetween,
  volumeBetween,
  volumeByDay,
  weekStreak,
} from "../lib/stats";
import { formatKg } from "../lib/trainingSets";

const DAY_MS = 24 * 60 * 60 * 1000;

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: plan } = useTrainingPlan();
  const { data: status } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", { enabled: !!plan });
  const { data: session } = useOpenWorkoutSession();
  const { data: logs, isLoading: logsLoading } = useWorkoutLogs();
  const { data: challenge } = useDailyChallenge();
  const { data: supplements } = useSupplements();
  const { data: bodyEntries } = useBodyCompositionEntries();
  const stretch = useDailyStretchStatus();

  const allLogs = useMemo(() => logs ?? [], [logs]);
  const now = new Date();
  const today = utcDayKey(now);
  const weekKeys = currentWeekDayKeys();
  const trainedDays = useMemo(() => new Set(allLogs.map((l) => utcDayKey(new Date(l.performedAt)))), [allLogs]);
  const dayVolumes = useMemo(() => volumeByDay(allLogs), [allLogs]);
  const workoutDays = useMemo(() => lastWorkoutDays(allLogs, 5), [allLogs]);

  const weekStart = mondayOf(now);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const nextWeekStart = new Date(weekStart.getTime() + 7 * DAY_MS);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const weekVolume = volumeBetween(allLogs, weekStart, nextWeekStart);
  const prevWeekVolume = volumeBetween(allLogs, prevWeekStart, weekStart);
  const trainedThisWeek = trainedDaysBetween(allLogs, weekStart, nextWeekStart);
  const targetDays = status && status.days.length > 0 ? status.days.length : null;
  const records = recordsBetween(allLogs, monthStart, nextWeekStart);

  const sortedBody = [...(bodyEntries ?? [])].sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1));
  const latestBody = sortedBody.at(-1);
  const threeMonthsAgo = now.getTime() - 90 * DAY_MS;
  const bodyBaseline = sortedBody.find((e) => new Date(e.measuredAt).getTime() >= threeMonthsAgo);
  const bodyDelta =
    latestBody && bodyBaseline && bodyBaseline.id !== latestBody.id ? latestBody.weightKg - bodyBaseline.weightKg : null;

  const lastDayOfActive = (() => {
    const activeDay = status && status.activeDayIndex !== null ? status.days[status.activeDayIndex] : null;
    if (!activeDay) return null;
    const ids = new Set(activeDay.exercises.map((e) => e.exerciseId));
    const last = allLogs.filter((l) => ids.has(l.exerciseId)).map((l) => utcDayKey(new Date(l.performedAt))).sort().at(-1);
    return last ? daysAgo(last, now) : null;
  })();

  const challengeDone = challenge ? challenge.filter((i) => i.completedReps >= i.targetReps).length : 0;
  const enabledSupplements = (supplements ?? []).filter((s) => s.enabled);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const dueSupplements = enabledSupplements.filter((s) => {
    const [h, m] = s.reminderTime.split(":").map(Number);
    return h * 60 + m <= minutesNow;
  });

  const rows: ChecklistRow[] = [
    {
      key: "training",
      title: "Training",
      meta: session ? "läuft" : trainedDays.has(today) ? "heute geloggt" : "noch offen",
      done: trainedDays.has(today),
      to: session ? "/training" : "/diary",
    },
    {
      key: "challenge",
      title: "Tages-Challenge",
      meta: challenge && challenge.length > 0 ? `${challengeDone} von ${challenge.length}` : undefined,
      done: !!challenge && challenge.length > 0 && challengeDone === challenge.length,
      to: "/daily",
    },
    {
      key: "stretch",
      title: "Dehnroutine",
      meta: stretch.total > 0 ? `${stretch.completed} von ${stretch.total}` : undefined,
      done: stretch.isDone,
      to: "/daily",
    },
  ];
  if (enabledSupplements.length > 0) {
    rows.push({
      key: "supplements",
      title: "Supplements",
      meta: dueSupplements.length > 0 ? `${dueSupplements.length} fällig` : "heute noch keine fällig",
      done: dueSupplements.length === enabledSupplements.length,
      to: "/nutrition",
    });
  }

  const subline = plan
    ? [
        `Phase ${TRAINING_PHASE_LABELS[plan.currentPhase]}`,
        `Woche ${phaseWeek(plan)} von ${phaseLength(plan)}`,
        status && status.activeDayIndex !== null ? `heute Tag ${status.activeDayIndex + 1}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Noch kein Trainingsplan";

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="text-h1 text-text lg:text-h1-lg">
          {greeting(now)}
          {user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
        <p className="mt-1 text-body text-text-subtle">
          {plan ? subline : <>Noch kein Trainingsplan</>}
        </p>
      </div>

      {logsLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div className="mb-4 hidden gap-4 lg:grid lg:grid-cols-4">
            <StatTile
              label="Trainingstage / Woche"
              value={trainedThisWeek}
              sub={targetDays ? `Ziel ${targetDays}` : undefined}
            />
            <StatTile
              label="Volumen der Woche"
              value={formatKg(Math.round(weekVolume))}
              unit="kg"
              sub={
                prevWeekVolume > 0
                  ? `${formatDelta(Math.round(weekVolume - prevWeekVolume))} kg zur Vorwoche`
                  : undefined
              }
              subTone={weekVolume >= prevWeekVolume ? "accent" : "muted"}
            />
            <StatTile label="Neue Rekorde im Monat" value={records} />
            <StatTile
              label="Körpergewicht"
              value={latestBody ? formatKg(latestBody.weightKg) : "–"}
              unit={latestBody ? "kg" : undefined}
              sub={bodyDelta !== null ? `${formatDelta(bodyDelta, 1)} kg in 3 Monaten` : undefined}
            />
          </div>

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
            <div className="lg:col-start-1 lg:row-start-1">
              <HeroCard plan={plan} status={status} session={session} lastTrainedDaysAgo={lastDayOfActive} />
            </div>
            <div className="lg:col-start-2 lg:row-start-1">
              <TodayChecklist rows={rows} />
            </div>
            <div className="lg:col-start-1 lg:row-start-2">
              <WeekCard
                weekKeys={weekKeys}
                today={today}
                trainedDays={trainedDays}
                volumeByDay={dayVolumes}
                weekStreak={weekStreak(allLogs, now)}
                targetDays={targetDays}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:grid-cols-1">
              <GoalTile />
              <div className="lg:hidden">
                <LastWorkoutTile days={workoutDays} />
              </div>
            </div>
            <div className="hidden lg:col-start-1 lg:row-start-3 lg:block">
              <RecentWorkoutsTable days={workoutDays} />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
