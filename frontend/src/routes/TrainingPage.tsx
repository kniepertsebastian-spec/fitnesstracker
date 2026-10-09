import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Dumbbell } from "lucide-react";
import type { PlanDiaryExerciseDto } from "@fitnesstracker/shared";
import type { LocalWorkoutLog } from "../offline/db";
import { PRToastHost } from "../components/layout/PRToastHost";
import { ExerciseCard } from "../components/training/ExerciseCard";
import type { SetValues } from "../components/training/ExerciseCard";
import { CardioStage } from "../components/training/CardioStage";
import type { CardioEntry } from "../components/training/CardioStage";
import { FocusBar } from "../components/training/FocusBar";
import { StageBar } from "../components/training/StageBar";
import type { StageInfo } from "../components/training/StageBar";
import { StretchList } from "../components/stretching/StretchList";
import { RestCard } from "../components/training/RestCard";
import { TechniqueSheet } from "../components/training/TechniqueSheet";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  Dialog,
  EmptyState,
  ListRow,
  Skeleton,
  StatTile,
} from "../components/ui";
import type { SegmentState } from "../components/ui";
import { useWeekCardioLogs } from "../hooks/useCardioLogs";
import { useCardioPlan } from "../hooks/useCardioPlan";
import { useExercise } from "../hooks/useExerciseLibrary";
import { useStretchPlan } from "../hooks/useStretching";
import { useWeeklyPlanStatus } from "../hooks/usePlanExercises";
import { TRAINING_PHASE_LABELS, useTrainingPlan } from "../hooks/useTrainingPlan";
import { useCreateWorkoutLog, useDeleteWorkoutLog, useWorkoutLogs } from "../hooks/useWorkoutLogs";
import {
  useOpenWorkoutSession,
  useStartWorkoutSession,
  useUpdateWorkoutSessionStatus,
} from "../hooks/useWorkoutSession";
import { cardioMinutes, matchDay, stretchMinutes } from "../lib/dayPlan";
import { phaseLength, phaseWeek } from "../lib/phase";
import {
  STAGE_LABELS,
  defaultStage,
  emptyStageState,
  loadStageState,
  saveStageState,
  stretchStorageKey,
  type SectionState,
  type Stage,
  type StageState,
} from "../lib/trainingStages";
import { loadStretchDone } from "../lib/stretchStorage";
import { createCardioLogLocal } from "../offline/cardioLogSync";
import { detectPRs, prLabels } from "../lib/prDetection";
import { unlockAudio } from "../lib/timerSound";
import { formatDuration, formatKg, lastTimeSets, sessionSets } from "../lib/trainingSets";
import { usePRToastStore } from "../stores/prToastStore";
import { useTimerStore } from "../stores/timerStore";

interface Summary {
  seconds: number;
  sets: number;
  volumeKg: number;
  records: number;
  cardioMinutes: number;
  stretchDone: number;
  stretchTotal: number;
  aborted: boolean;
}

// Focus mode: one exercise at a time, no shell navigation. Every write goes through the same
// offline-capable hooks as the diary (useCreateWorkoutLog, useUpdateWorkoutSessionStatus), and
// "done" is derived from the logs written since the session started — so a reload, or logging a
// set elsewhere meanwhile, never leaves this view out of sync.
export function TrainingPage() {
  const navigate = useNavigate();
  const { data: session, isLoading: sessionLoading } = useOpenWorkoutSession();
  const { data: plan, isLoading: planLoading } = useTrainingPlan();
  const { data: status, isLoading: statusLoading } = useWeeklyPlanStatus(plan?.currentPhase ?? "AUFBAU", {
    enabled: !!plan,
  });
  const { data: logs } = useWorkoutLogs();
  const createLog = useCreateWorkoutLog();
  const deleteLog = useDeleteWorkoutLog();
  const startSession = useStartWorkoutSession();
  const updateStatus = useUpdateWorkoutSessionStatus();
  const showPR = usePRToastStore((s) => s.showPR);
  const { autoStartEnabled, autoStartSeconds, start: startRestTimer } = useTimerStore();

  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [setCounts, setSetCounts] = useState<Record<string, number>>({});
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [techniqueOpen, setTechniqueOpen] = useState(false);
  const [superset, setSuperset] = useState<{ active: boolean; groupId: string | null }>({
    active: false,
    groupId: null,
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const recordCount = useRef(0);
  const { data: cardioPlan } = useCardioPlan(plan?.currentPhase, { enabled: !!plan });
  const { data: stretchPlan } = useStretchPlan(plan?.currentPhase ?? "AUFBAU");
  const { data: recentCardio } = useWeekCardioLogs();
  const [manualStage, setManualStage] = useState<Stage | null>(null);
  const [stageState, setStageState] = useState<StageState>(emptyStageState);
  const [stretchDone, setStretchDone] = useState<string[]>([]);
  const sessionClientId = session?.clientId ?? null;

  // Per-session section status (skipped/done cardio, stretching) — loaded once per session.
  useEffect(() => {
    if (!sessionClientId) return;
    setStageState(loadStageState(sessionClientId));
    setStretchDone(loadStretchDone(stretchStorageKey(sessionClientId)));
  }, [sessionClientId]);

  const updateStageState = (update: (s: StageState) => StageState) =>
    setStageState((current) => {
      const next = update(current);
      if (sessionClientId) saveStageState(sessionClientId, next);
      return next;
    });

  // The auto-detected active day is only the default, captured once — logging a set must never
  // switch the view to another day underneath someone mid-workout.
  useEffect(() => {
    if (dayIndex === null && status && status.days.length > 0) {
      setDayIndex(status.activeDayIndex ?? 0);
    }
  }, [status, dayIndex]);

  const day = status && dayIndex !== null ? status.days[Math.min(dayIndex, status.days.length - 1)] : null;
  const exercises: PlanDiaryExerciseDto[] = useMemo(() => day?.exercises ?? [], [day]);
  const allLogs = useMemo(() => logs ?? [], [logs]);
  const startedAt = session?.startedAt ?? "";

  const setCountFor = (entry: PlanDiaryExerciseDto) => setCounts[entry.id] ?? entry.targetSets ?? 3;
  const doneFor = (entry: PlanDiaryExerciseDto) => (session ? sessionSets(allLogs, entry.exerciseId, startedAt) : []);
  const isComplete = (entry: PlanDiaryExerciseDto) => doneFor(entry).length >= setCountFor(entry);

  const firstIncomplete = exercises.findIndex((e) => !isComplete(e));
  const currentIndex = Math.min(
    manualIndex ?? (firstIncomplete === -1 ? Math.max(0, exercises.length - 1) : firstIncomplete),
    Math.max(0, exercises.length - 1),
  );
  const current = exercises[currentIndex];
  const allDone = exercises.length > 0 && firstIncomplete === -1;
  const { data: currentExercise } = useExercise(current?.exerciseId);

  // F9: Aufwärmen → Kraft → Cardio → Dehnen. Sections without planned content are left out.
  const dayLabel = day?.dayLabel ?? null;
  const cardioDay = matchDay(cardioPlan?.days, dayLabel);
  const warmupItems = cardioDay?.items.filter((i) => i.slot === "WARMUP") ?? [];
  const afterItems = cardioDay?.items.filter((i) => i.slot === "AFTER") ?? [];
  const stretchItems = matchDay(stretchPlan?.days, dayLabel)?.items ?? [];
  const stages: Stage[] = [
    ...(warmupItems.length > 0 ? (["warmup"] as const) : []),
    "kraft" as const,
    ...(afterItems.length > 0 ? (["cardio"] as const) : []),
    ...(stretchItems.length > 0 ? (["stretch"] as const) : []),
  ];
  const stage: Stage = manualStage && stages.includes(manualStage) ? manualStage : defaultStage(stages, stageState, allDone);
  const nextStage = stages[stages.indexOf(stage) + 1] ?? null;

  const segments: SegmentState[] = exercises.map((e, i) =>
    isComplete(e) ? "done" : i === currentIndex ? "current" : "open",
  );
  const setsTotal = exercises.reduce((sum, e) => sum + setCountFor(e), 0);
  const setsDone = exercises.reduce((sum, e) => sum + Math.min(doneFor(e).length, setCountFor(e)), 0);
  const stretchDoneCount = stretchItems.filter((i) => stretchDone.includes(i.exerciseId)).length;

  const sectionProgress = (key: "warmup" | "cardio", items: unknown[]) =>
    stageState[key].status !== "open" ? 1 : items.length === 0 ? 0 : stageState[key].doneItems.length / items.length;
  const stageInfos: StageInfo[] = stages.map((s) => ({
    stage: s,
    skipped: s !== "kraft" && stageState[s].status === "skipped",
    progress:
      s === "kraft"
        ? setsTotal === 0 ? 0 : setsDone / setsTotal
        : s === "warmup"
          ? sectionProgress("warmup", warmupItems)
          : s === "cardio"
            ? sectionProgress("cardio", afterItems)
            : stageState.stretch.status !== "open"
              ? 1
              : stretchItems.length === 0
                ? 0
                : stretchDoneCount / stretchItems.length,
  }));

  const goToStage = (next: Stage | null) => {
    if (next) setManualStage(next);
    window.scrollTo({ top: 0 });
  };

  const skipSection = (key: "warmup" | "cardio" | "stretch") => {
    updateStageState((s) => {
      const section: SectionState = { ...s[key], status: s[key].status === "done" ? "done" : "skipped" };
      return { ...s, [key]: section };
    });
    goToStage(stages[stages.indexOf(key) + 1] ?? null);
  };

  const saveCardio = async (key: "warmup" | "cardio", items: unknown[], index: number, entry: CardioEntry) => {
    if (busy) return;
    setBusy(true);
    try {
      await createCardioLogLocal(
        {
          clientId: crypto.randomUUID(),
          performedAt: new Date().toISOString(),
          machine: entry.machine,
          level: entry.level,
          intensity: entry.intensity,
          durationMinutes: entry.durationMinutes,
        },
        `${STAGE_LABELS[key]} · ${entry.durationMinutes} Min.`,
      );
      const doneItems = [...new Set([...stageState[key].doneItems, index])];
      const finished = doneItems.length >= items.length;
      updateStageState((s) => {
        const section: SectionState = {
          status: finished ? "done" : s[key].status,
          doneItems,
          minutesLogged: s[key].minutesLogged + entry.durationMinutes,
        };
        return { ...s, [key]: section };
      });
      if (finished) goToStage(stages[stages.indexOf(key) + 1] ?? null);
    } finally {
      setBusy(false);
    }
  };

  const paused = session?.status === "PAUSED";

  const logSet = async (entry: PlanDiaryExerciseDto, values: SetValues, setNumber: number) => {
    if (busy || !session) return;
    setBusy(true);
    try {
      const performedAt = new Date().toISOString();
      const prs = detectPRs(allLogs, entry.exerciseId, [
        { reps: values.reps, weightKg: values.weightKg, performedAt },
      ]);
      await createLog.mutateAsync({
        input: {
          clientId: crypto.randomUUID(),
          exerciseId: entry.exerciseId,
          setNumber,
          reps: values.reps,
          weightKg: values.weightKg,
          rir: values.rir,
          supersetGroupId: superset.active ? superset.groupId : null,
        },
        exerciseName: entry.exerciseName,
      });
      const labels = prLabels(prs);
      if (labels.length > 0) {
        recordCount.current += 1;
        showPR(entry.exerciseName, labels);
      }
      unlockAudio();
      if (autoStartEnabled) {
        startRestTimer(autoStartSeconds, `${entry.exerciseName} · Satz ${setNumber} fertig`);
      }
      // Last set of this exercise → move on to the next one that still has open sets.
      if (doneFor(entry).length + 1 >= setCountFor(entry)) {
        const next = exercises.findIndex((e, i) => i !== currentIndex && !isComplete(e));
        setManualIndex(next === -1 ? currentIndex : next);
        // The very last set: stay on Kraft (rest timer, undo) instead of jumping straight to the
        // next section; the callout offers "Weiter mit …".
        if (next === -1) setManualStage("kraft");
      }
    } finally {
      setBusy(false);
    }
  };

  const undoSet = async (log: LocalWorkoutLog) => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteLog.mutateAsync(log.clientId);
    } finally {
      setBusy(false);
    }
  };

  const toggleSuperset = () =>
    setSuperset((s) => (s.active ? { active: false, groupId: null } : { active: true, groupId: crypto.randomUUID() }));

  const setStatus = (next: "ACTIVE" | "PAUSED" | "COMPLETED" | "ABORTED") =>
    session ? updateStatus.mutateAsync({ clientId: session.clientId, status: next }) : Promise.resolve();

  const finish = async (aborted: boolean) => {
    if (!session) return;
    const sessionLogs = allLogs.filter((l) => l.performedAt >= session.startedAt);
    const result: Summary = {
      seconds: (Date.now() - new Date(session.startedAt).getTime()) / 1000,
      sets: sessionLogs.length,
      volumeKg: sessionLogs.reduce((sum, l) => sum + l.weightKg * l.reps, 0),
      records: recordCount.current,
      cardioMinutes: stageState.warmup.minutesLogged + stageState.cardio.minutesLogged,
      stretchDone: stretchDoneCount,
      stretchTotal: stretchItems.length,
      aborted,
    };
    setLeaveOpen(false);
    // Summary first: once the session closes, `session` turns null and would flash "Kein Training".
    setSummary(result);
    useTimerStore.getState().reset();
    await setStatus(aborted ? "ABORTED" : "COMPLETED");
  };

  const pauseAndLeave = async () => {
    setLeaveOpen(false);
    await setStatus("PAUSED");
    navigate("/");
  };

  const togglePause = () => void setStatus(paused ? "ACTIVE" : "PAUSED");

  if (summary) {
    return (
      <Frame>
        <Card variant="hero">
          <p className="text-overline uppercase text-accent">{summary.aborted ? "Abgebrochen" : "Training abgeschlossen"}</p>
          <h1 className="mt-1 text-h2-hero text-text">{summary.aborted ? "Training abgebrochen" : "Stark gemacht."}</h1>
          <p className="mt-1 text-small text-text-subtle">Alle Sätze und Cardio-Einheiten sind gespeichert.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="Dauer" value={formatDuration(summary.seconds)} />
            <StatTile label="Sätze" value={summary.sets} />
            <StatTile label="Volumen" value={formatKg(Math.round(summary.volumeKg))} unit="kg" />
            <StatTile label="Rekorde" value={summary.records} />
            <StatTile label="Cardio" value={summary.cardioMinutes} unit="Min." />
            {summary.stretchTotal > 0 && (
              <StatTile label="Dehnen" value={`${summary.stretchDone} von ${summary.stretchTotal}`} />
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink to="/history" variant="primary" size="lg">
              Zur Historie
            </ButtonLink>
            <ButtonLink to="/" variant="ghost" size="lg">
              Zum Dashboard
            </ButtonLink>
          </div>
        </Card>
      </Frame>
    );
  }

  if (sessionLoading || planLoading || (plan && statusLoading)) {
    return (
      <Frame>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-3 h-64 w-full" />
      </Frame>
    );
  }

  if (!session) {
    return (
      <Frame>
        <Card>
          <EmptyState
            icon={<Dumbbell size={20} aria-hidden />}
            text="Kein Training aktiv."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  disabled={startSession.isPending}
                  onClick={() => startSession.mutate(crypto.randomUUID())}
                >
                  Training starten
                </Button>
                <ButtonLink to="/" variant="ghost" size="lg">
                  Zum Dashboard
                </ButtonLink>
              </div>
            }
          />
        </Card>
      </Frame>
    );
  }

  const title = day?.dayLabel ?? (dayIndex !== null ? `Tag ${dayIndex + 1}` : "Training");
  const subtitle = plan
    ? `${TRAINING_PHASE_LABELS[plan.currentPhase]} · Woche ${phaseWeek(plan)} von ${phaseLength(plan)}`
    : "Freies Training";

  if (!plan || exercises.length === 0) {
    return (
      <Frame>
        <Card>
          <EmptyState
            icon={<Dumbbell size={20} aria-hidden />}
            text="Für heute sind keine Plan-Übungen hinterlegt. Du kannst Sätze frei im Fitnesstagebuch loggen."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to="/diary" variant="primary" size="lg">
                  Zum Fitnesstagebuch
                </ButtonLink>
                <ButtonLink to="/plan" variant="ghost" size="lg">
                  Plan bearbeiten
                </ButtonLink>
                <Button variant="ghost" size="lg" onClick={() => void finish(true)}>
                  Training beenden
                </Button>
              </div>
            }
          />
        </Card>
      </Frame>
    );
  }

  const detailLeft =
    stage === "kraft"
      ? `Kraft · Übung ${currentIndex + 1} von ${exercises.length}`
      : stage === "stretch"
        ? `Dehnen · ${stretchDoneCount} von ${stretchItems.length}`
        : STAGE_LABELS[stage];
  const nextLabel = nextStage ? `Weiter: ${STAGE_LABELS[nextStage]}` : null;

  return (
    <div className="min-h-screen bg-bg pb-[env(safe-area-inset-bottom)] text-text">
      <PRToastHost />
      <FocusBar
        title={title}
        subtitle={subtitle}
        startedAt={session.startedAt}
        status={session.status}
        pausedAt={session.updatedAt}
        stageBar={stages.length > 1 ? <StageBar stages={stageInfos} current={stage} onSelect={goToStage} /> : undefined}
        segments={segments}
        detailLeft={detailLeft}
        detailRight={`${setsDone} von ${setsTotal} Sätzen`}
        onLeave={() => setLeaveOpen(true)}
        onTogglePause={togglePause}
      />

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
        {paused && (
          <Callout tone="warning">
            Training pausiert.{" "}
            <button type="button" onClick={togglePause} className="font-medium text-text underline">
              Fortsetzen
            </button>
          </Callout>
        )}

        {stage === "warmup" && (
          <CardioStage
            title="Aufwärmen"
            storageKey={`${session.clientId}:warmup`}
            items={warmupItems}
            doneItems={stageState.warmup.doneItems}
            legDayHint={false}
            recentLogs={recentCardio ?? []}
            disabled={paused}
            busy={busy}
            onSave={(index, entry) => void saveCardio("warmup", warmupItems, index, entry)}
            onSkip={() => skipSection("warmup")}
          />
        )}

        {stage === "kraft" && (
          <>
            <ExerciseCard
              key={current.id}
              entry={current}
              phase={plan.currentPhase}
              exercise={currentExercise}
              done={doneFor(current)}
              previous={lastTimeSets(allLogs, current.exerciseId, startedAt)}
              setCount={setCountFor(current)}
              disabled={paused}
              busy={busy}
              supersetActive={superset.active}
              onSetCountChange={(count) => setSetCounts((c) => ({ ...c, [current.id]: count }))}
              onLogSet={(values, setNumber) => void logSet(current, values, setNumber)}
              onUndoSet={(log) => void undoSet(log)}
              onToggleSuperset={toggleSuperset}
              onOpenTechnique={() => setTechniqueOpen(true)}
            />

            <RestCard />

            {allDone && (
              <Callout tone="info">
                Alle Übungen erledigt.{" "}
                {nextStage ? (
                  <button type="button" onClick={() => goToStage(nextStage)} className="font-medium text-text underline">
                    Weiter mit {STAGE_LABELS[nextStage]}
                  </button>
                ) : (
                  "Schließe das Training unten ab."
                )}
              </Callout>
            )}
          </>
        )}

        {stage === "cardio" && (
          <>
            {allDone ? null : (
              <Callout tone="warning">
                Es sind noch Sätze offen.{" "}
                <button type="button" onClick={() => goToStage("kraft")} className="font-medium text-text underline">
                  Zurück zur Kraft
                </button>
              </Callout>
            )}
            <CardioStage
              title="Cardio · nach dem Krafttraining"
              storageKey={`${session.clientId}:cardio`}
              items={afterItems}
              doneItems={stageState.cardio.doneItems}
              reason={cardioPlan?.reason}
              legDayHint={cardioDay?.isLegDay ?? false}
              recentLogs={recentCardio ?? []}
              disabled={paused}
              busy={busy}
              onSave={(index, entry) => void saveCardio("cardio", afterItems, index, entry)}
              onSkip={() => skipSection("cardio")}
            />
          </>
        )}

        {stage === "stretch" && (
          <Card>
            <Badge tone="violet">Dehnplan {title}</Badge>
            <h1 className="mt-2 text-h1-focus text-text">Dehnen</h1>
            <p className="mt-1 text-small text-text-subtle">
              Für die heute trainierten Muskeln. Ruhig atmen, nicht federn. „Halten“ startet den Timer.
            </p>
            <div className="mt-4">
              <StretchList items={stretchItems} storageKey={stretchStorageKey(session.clientId)} onDoneChange={setStretchDone} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="ghost" size="lg" onClick={() => skipSection("stretch")}>
                Überspringen
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() =>
                  updateStageState((s) => {
                    const stretch: SectionState = { ...s.stretch, status: "done" };
                    return { ...s, stretch };
                  })
                }
                disabled={stageState.stretch.status === "done"}
              >
                {stageState.stretch.status === "done" ? "Dehnen erledigt" : "Dehnen abschließen"}
              </Button>
            </div>
          </Card>
        )}

        {stage !== "kraft" && stage !== "stretch" && nextLabel && (
          <Button
            variant="ghost"
            size="lg"
            iconRight={<ArrowRight size={16} aria-hidden />}
            onClick={() => goToStage(nextStage)}
          >
            {nextLabel}
          </Button>
        )}

        <Card title="Ablauf heute">
          {stages.map((s) => (
            <ListRow
              key={s}
              value={
                s === "kraft"
                  ? `${setsDone}/${setsTotal} Sätze`
                  : s === "warmup"
                    ? `${cardioMinutes(warmupItems)} Min.`
                    : s === "cardio"
                      ? `${cardioMinutes(afterItems)} Min.`
                      : `${stretchMinutes(stretchItems)} Min.`
              }
              className={s === stage ? undefined : "opacity-80"}
            >
              <button type="button" onClick={() => goToStage(s)} className="block w-full py-3 text-left hover:text-accent">
                {STAGE_LABELS[s]}
                {s === stage && <span className="ml-2 text-xs text-accent">jetzt</span>}
                {s !== "kraft" && stageState[s].status === "skipped" && (
                  <span className="ml-2 text-xs text-text-faint">übersprungen</span>
                )}
                {((s === "kraft" && allDone) || (s !== "kraft" && stageState[s].status === "done")) && (
                  <span className="ml-2 text-xs text-accent">erledigt</span>
                )}
              </button>
            </ListRow>
          ))}
        </Card>

        {stage === "kraft" && exercises.some((_, i) => i !== currentIndex) && (
          <Card title="Als Nächstes">
            {exercises.map((e, i) =>
              i === currentIndex ? null : (
                <ListRow
                  key={e.id}
                  prefix={i + 1}
                  value={`${setCountFor(e)} × ${e.targetReps ?? "–"}`}
                  className={isComplete(e) ? "opacity-60" : undefined}
                >
                  <button
                    type="button"
                    onClick={() => setManualIndex(i)}
                    className="block w-full py-3 text-left hover:text-accent"
                  >
                    {e.exerciseName}
                    {isComplete(e) && <span className="ml-2 text-xs text-accent">erledigt</span>}
                  </button>
                </ListRow>
              ),
            )}
          </Card>
        )}

        <div className="flex gap-2 pb-4">
          <Button variant="ghost" size="lg" className="flex-1" onClick={() => setLeaveOpen(true)}>
            Abbrechen
          </Button>
          <Button
            variant={allDone && !nextStage ? "primary" : "secondary"}
            size="lg"
            className="flex-1"
            onClick={() => void finish(false)}
          >
            Training abschließen
          </Button>
        </div>
        {stages.length > 1 && (
          <p className="-mt-2 pb-4 text-center text-xs text-text-faint">
            Cardio und Dehnen lassen sich überspringen, das Training gilt trotzdem als abgeschlossen.
          </p>
        )}
      </main>

      <TechniqueSheet exerciseId={current.exerciseId} open={techniqueOpen} onOpenChange={setTechniqueOpen} />

      <Dialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Training verlassen?"
        description="Alle bisher geloggten Sätze bleiben gespeichert."
      >
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="lg" onClick={() => void pauseAndLeave()}>
            Pausieren
          </Button>
          <Button variant="primary" size="lg" onClick={() => void finish(false)}>
            Abschließen
          </Button>
          <Button variant="danger" size="lg" onClick={() => void finish(true)}>
            Abbrechen (Sätze bleiben gespeichert)
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg px-4 pb-[env(safe-area-inset-bottom)] pt-[calc(1rem+env(safe-area-inset-top))] text-text">
      <div className="mx-auto max-w-2xl">{children}</div>
      <Link to="/" className="sr-only">
        Zum Dashboard
      </Link>
    </div>
  );
}
