import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  CARDIO_MACHINE_LABELS,
  type CardioLogDto,
  type CardioMachine,
  type CardioPlanItem,
} from "@fitnesstracker/shared";
import { formatDuration } from "../../lib/trainingSets";
import { Badge, Button, Card, Field, IconButton, Input, ProgressBar, SegmentedControl, Stepper } from "../ui";

const MACHINES = Object.keys(CARDIO_MACHINE_LABELS) as CardioMachine[];
// The cardio log stores intensity with this limit (createCardioLogSchema).
const LOG_INTENSITY_MAX = 50;

export interface CardioEntry {
  machine: CardioMachine;
  level: number | null;
  intensity: string;
  durationMinutes: number;
}

interface StopwatchState {
  accumulatedMs: number;
  runningSince: number | null;
}

// Survives a reload mid-session (the phone locking during a 20-minute ride is the normal case).
function useStopwatch(storageKey: string) {
  const [state, setState] = useState<StopwatchState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as StopwatchState;
    } catch {
      // ignore
    }
    return { accumulatedMs: 0, runningSince: null };
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [storageKey, state]);

  useEffect(() => {
    if (state.runningSince === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.runningSince]);

  const elapsedMs = state.accumulatedMs + (state.runningSince !== null ? now - state.runningSince : 0);
  return {
    running: state.runningSince !== null,
    elapsedSeconds: Math.max(0, Math.floor(elapsedMs / 1000)),
    start: () => {
      setNow(Date.now());
      setState((s) => (s.runningSince !== null ? s : { ...s, runningSince: Date.now() }));
    },
    stop: () =>
      setState((s) =>
        s.runningSince === null ? s : { accumulatedMs: s.accumulatedMs + Date.now() - s.runningSince, runningSince: null },
      ),
    reset: () => setState({ accumulatedMs: 0, runningSince: null }),
  };
}

interface Props {
  /** "Aufwärmen" or "Cardio". */
  title: string;
  storageKey: string;
  items: CardioPlanItem[];
  doneItems: number[];
  reason?: string;
  legDayHint: boolean;
  recentLogs: CardioLogDto[];
  disabled: boolean;
  busy: boolean;
  onSave: (index: number, entry: CardioEntry) => void;
  onSkip: () => void;
}

export function CardioStage({ title, storageKey, items, doneItems, reason, legDayHint, recentLogs, disabled, busy, onSave, onSkip }: Props) {
  const index = items.findIndex((_, i) => !doneItems.includes(i));
  const item = index === -1 ? null : items[index];
  // Keyed by the item so the form starts from the plan again for the next planned unit.
  return item ? (
    <CardioItemForm
      key={`${storageKey}:${index}`}
      title={title}
      storageKey={`${storageKey}:${index}`}
      item={item}
      position={items.length > 1 ? `${index + 1} von ${items.length}` : null}
      reason={reason}
      legDayHint={legDayHint}
      recentLogs={recentLogs}
      disabled={disabled}
      busy={busy}
      onSave={(entry) => onSave(index, entry)}
      onSkip={onSkip}
    />
  ) : null;
}

function CardioItemForm({
  title,
  storageKey,
  item,
  position,
  reason,
  legDayHint,
  recentLogs,
  disabled,
  busy,
  onSave,
  onSkip,
}: {
  title: string;
  storageKey: string;
  item: CardioPlanItem;
  position: string | null;
  reason?: string;
  legDayHint: boolean;
  recentLogs: CardioLogDto[];
  disabled: boolean;
  busy: boolean;
  onSave: (entry: CardioEntry) => void;
  onSkip: () => void;
}) {
  const stopwatch = useStopwatch(`stopwatch:${storageKey}`);
  const [machine, setMachine] = useState<CardioMachine>(item.machine);
  const last = recentLogs.find((l) => l.machine === machine) ?? null;
  const [minutes, setMinutes] = useState(item.durationMinutes);
  const [level, setLevel] = useState(last?.level ?? 0);
  const [intensity, setIntensity] = useState(item.intensity.slice(0, LOG_INTENSITY_MAX));

  const plannedSeconds = item.durationMinutes * 60;
  const pause = () => {
    stopwatch.stop();
    // A measured duration replaces the planned one; the stepper stays adjustable.
    const measured = Math.round(stopwatch.elapsedSeconds / 60);
    if (measured >= 1) setMinutes(measured);
  };

  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        <Badge tone="info">{title}</Badge>
        {position && <Badge tone="neutral">Einheit {position}</Badge>}
      </div>
      <h1 className="mt-2 text-h1-focus text-text">{CARDIO_MACHINE_LABELS[item.machine]}</h1>
      <p className="mt-1 text-small text-text-2">{item.intensity}</p>
      {reason && <p className="mt-1 text-small text-text-subtle">{reason}</p>}
      {legDayHint && <p className="mt-1 text-small text-text-subtle">Beintag: ohne Steigung und mit wenig Widerstand.</p>}

      <div className="mt-4 flex items-center gap-4 border-t border-border-subtle pt-4">
        <div className="min-w-0">
          <p className="text-overline uppercase text-text-subtle">{stopwatch.running ? "Läuft" : stopwatch.elapsedSeconds > 0 ? "Pausiert" : "Bereit"}</p>
          <p role="timer" aria-label="Cardio-Zeit" className="tabular font-mono text-timer text-text">
            {formatDuration(stopwatch.elapsedSeconds)}
          </p>
          <p className="text-small text-text-faint">geplant {item.durationMinutes} Min.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {stopwatch.elapsedSeconds > 0 && !stopwatch.running && (
            <IconButton aria-label="Zeit zurücksetzen" onClick={stopwatch.reset}>
              <RotateCcw size={18} aria-hidden />
            </IconButton>
          )}
          <button
            type="button"
            disabled={disabled}
            aria-label={stopwatch.running ? "Cardio-Zeit anhalten" : "Cardio-Zeit starten"}
            onClick={stopwatch.running ? pause : stopwatch.start}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-info text-bg transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
          >
            {stopwatch.running ? <Pause size={24} aria-hidden /> : <Play size={24} aria-hidden />}
          </button>
        </div>
      </div>
      <ProgressBar
        className="mt-3"
        tone="info"
        value={(stopwatch.elapsedSeconds / plannedSeconds) * 100}
        label="Cardio-Zeit im Verhältnis zur geplanten Dauer"
      />

      <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4">
        <SegmentedControl<CardioMachine>
          label="Gerät"
          className="w-full"
          value={machine}
          onChange={setMachine}
          options={MACHINES.map((m) => ({ value: m, label: CARDIO_MACHINE_LABELS[m] }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-text-muted">Dauer</span>
            <Stepper label="Dauer" unit="Min." min={1} max={300} value={minutes} onChange={(v) => setMinutes(Math.max(1, v))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-small font-medium text-text-muted">Stufe (0 = ohne)</span>
            <Stepper label="Stufe" min={0} max={50} value={level} onChange={setLevel} />
          </div>
        </div>
        <Field label="Intensität" hint="z. B. 9 km/h, 120 W oder Zone 2">
          {(p) => <Input {...p} maxLength={LOG_INTENSITY_MAX} value={intensity} onChange={(e) => setIntensity(e.target.value)} />}
        </Field>
        {last && (
          <p className="text-xs text-text-faint">
            Letztes Mal: {CARDIO_MACHINE_LABELS[last.machine]}
            {last.level ? `, Stufe ${last.level}` : ""}, {last.durationMinutes} Min., {last.intensity}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" size="lg" onClick={onSkip}>
          Überspringen
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={disabled || busy || intensity.trim() === ""}
          onClick={() => {
            stopwatch.stop();
            onSave({ machine, level: level > 0 ? level : null, intensity: intensity.trim(), durationMinutes: minutes });
          }}
        >
          Cardio speichern
        </Button>
      </div>
    </Card>
  );
}
