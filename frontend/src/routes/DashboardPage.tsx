import { Link, useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { GOAL_TYPE_LABELS, GOAL_TYPE_UNITS, useGoals } from "../hooks/useGoals";
import { useTodayCardioLogs } from "../hooks/useCardioLogs";
import { useDailyChallenge } from "../hooks/useDailyChallenge";
import { useWeeklyPlanStatus } from "../hooks/usePlanExercises";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../hooks/useTrainingPlan";
import { useWorkoutLogs } from "../hooks/useWorkoutLogs";
import { useOpenWorkoutSession, useStartWorkoutSession } from "../hooks/useWorkoutSession";
import { currentWeekDayKeys, isToday, trainingStreak, utcDayKey } from "../lib/dates";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">{children}</div>;
}

function TodayCard() {
  const navigate = useNavigate();
  const { data: plan } = useTrainingPlan();
  const { data: status } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", { enabled: !!plan });
  const { data: session } = useOpenWorkoutSession();
  const start = useStartWorkoutSession();

  const activeDay =
    status && status.activeDayIndex !== null ? status.days[status.activeDayIndex] : null;
  const allDone = !!status && status.days.length > 0 && status.activeDayIndex === null;

  let title = "Kein Trainingsplan aktiv";
  let subtitle: string | null = null;
  if (plan) {
    title = activeDay
      ? `${activeDay.dayLabel ?? `Tag ${status!.activeDayIndex! + 1}`}`
      : allDone
        ? "Woche geschafft 🎉"
        : "Heute dran";
    subtitle = [
      TRAINING_PHASE_LABELS[plan.currentPhase],
      activeDay ? `${activeDay.exercises.length} Übungen` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  const handleStart = () => {
    if (session) {
      navigate("/diary");
      return;
    }
    start.mutate(crypto.randomUUID(), { onSuccess: () => navigate("/diary") });
  };

  return (
    <Card>
      <p className="text-xs text-ink-500">Heute dran</p>
      <p className="mt-1 text-lg font-semibold text-ink-100">{title}</p>
      {subtitle && <p className="text-sm text-ink-400">{subtitle}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={handleStart}
          disabled={start.isPending}
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-violet-400 disabled:opacity-50"
        >
          {session ? "Zum Training" : "Training starten"}
        </button>
        {!plan && (
          <Link to="/plan" className="text-sm text-violet-400 hover:underline">
            Plan anlegen
          </Link>
        )}
      </div>
    </Card>
  );
}

function ChecklistCard({ trainedToday }: { trainedToday: boolean }) {
  const { data: challenge } = useDailyChallenge();
  const { data: cardio } = useTodayCardioLogs();
  const challengeDone =
    !!challenge && challenge.length > 0 && challenge.every((i) => i.completedReps >= i.targetReps);

  const rows = [
    { label: "Training", done: trainedToday, to: "/diary" },
    { label: "Tages-Challenge", done: challengeDone, to: "/daily" },
    { label: "Cardio", done: (cardio?.length ?? 0) > 0, to: "/daily" },
  ];

  return (
    <Card>
      <p className="mb-2 text-sm font-medium text-ink-300">Heute erledigt</p>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              to={row.to}
              className="flex items-center justify-between py-1.5 text-sm text-ink-200 hover:text-ink-100"
            >
              <span>{row.label}</span>
              <span className={row.done ? "text-emerald-400" : "text-ink-600"}>
                {row.done ? "✓" : "○"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WeekCard({ trainedDays }: { trainedDays: ReadonlySet<string> }) {
  const week = currentWeekDayKeys();
  const today = utcDayKey(new Date());
  const streak = trainingStreak(trainedDays);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-300">Diese Woche</p>
        <p className="text-xs text-ink-500">
          {streak > 0 ? `🔥 ${streak} ${streak === 1 ? "Tag" : "Tage"} in Folge` : "Noch keine Serie"}
        </p>
      </div>
      <div className="flex justify-between">
        {week.map((key, i) => {
          const trained = trainedDays.has(key);
          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                  trained
                    ? "bg-emerald-600 text-ink-950"
                    : key === today
                      ? "border border-violet-500 text-ink-300"
                      : "bg-ink-800 text-ink-600"
                }`}
              >
                {trained ? "✓" : ""}
              </span>
              <span className={`text-xs ${key === today ? "text-ink-200" : "text-ink-500"}`}>
                {WEEKDAYS[i]}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function NextGoalCard() {
  const { data: goals } = useGoals();
  const candidates = (goals ?? [])
    .filter((g) => !g.achievedAt && g.currentValue !== null && g.targetValue > 0)
    .map((g) => ({ goal: g, progress: Math.min(g.currentValue! / g.targetValue, 1) }))
    .sort((a, b) => b.progress - a.progress);
  const best = candidates[0];
  if (!best) return null;

  const { goal, progress } = best;
  const unit = GOAL_TYPE_UNITS[goal.type];
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-300">Nächstes Ziel</p>
        <Link to="/goals" className="text-xs text-violet-400 hover:underline">
          Alle Ziele
        </Link>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-ink-100">
          {goal.exerciseName ?? GOAL_TYPE_LABELS[goal.type]}
        </span>
        <span className="shrink-0 text-ink-500">
          {goal.currentValue}/{goal.targetValue} {unit}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${progress * 100}%` }} />
      </div>
    </Card>
  );
}

function LastWorkoutCard({ logs }: { logs: { performedAt: string; exerciseName: string }[] }) {
  const past = logs.filter((l) => !isToday(l.performedAt));
  if (past.length === 0) return null;

  const lastDay = past.map((l) => utcDayKey(new Date(l.performedAt))).sort().at(-1)!;
  const sets = past.filter((l) => utcDayKey(new Date(l.performedAt)) === lastDay);
  const exercises = [...new Set(sets.map((s) => s.exerciseName))];
  const shown = exercises.slice(0, 3).join(", ");
  const more = exercises.length > 3 ? ` +${exercises.length - 3}` : "";

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-300">Letztes Training</p>
        <Link to="/history" className="text-xs text-violet-400 hover:underline">
          Historie
        </Link>
      </div>
      <p className="text-sm text-ink-100">
        {new Date(`${lastDay}T00:00:00Z`).toLocaleDateString("de-DE", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        })}
        <span className="text-ink-500"> · {sets.length} Sätze</span>
      </p>
      <p className="text-sm text-ink-500">
        {shown}
        {more}
      </p>
    </Card>
  );
}

export function DashboardPage() {
  const { data: logs } = useWorkoutLogs();
  const allLogs = logs ?? [];
  const trainedDays = new Set(allLogs.map((l) => utcDayKey(new Date(l.performedAt))));
  const trainedToday = trainedDays.has(utcDayKey(new Date()));

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Dashboard</h1>
      <div className="flex flex-col gap-4">
        <TodayCard />
        <ChecklistCard trainedToday={trainedToday} />
        <WeekCard trainedDays={trainedDays} />
        <NextGoalCard />
        <LastWorkoutCard logs={allLogs} />
      </div>
    </AppShell>
  );
}
