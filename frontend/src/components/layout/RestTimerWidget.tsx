import { useEffect, useState } from "react";
import { useTimerStore } from "../../stores/timerStore";
import { unlockAudio } from "../../lib/timerSound";
import { Pause, Play, Timer, X } from "lucide-react";
import { TimerSettingsForm } from "../settings/TimerSettingsForm";
import { Button, IconButton, ProgressBar, cn } from "../ui";

const PRESETS_SECONDS = [30, 60, 90, 120];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function RestTimerWidget() {
  const {
    remainingSeconds,
    totalSeconds,
    isRunning,
    start,
    pause,
    resume,
    reset,
    label,
    syncFromClock,
  } = useTimerStore();
  const [expanded, setExpanded] = useState(false);
  const [customSeconds, setCustomSeconds] = useState("90");

  const idle = totalSeconds === 0;
  const finished = !idle && remainingSeconds === 0;

  // A backgrounded tab/app throttles setInterval, so the 1s tick alone can't be trusted to
  // notice a finished timer promptly — recompute from the stored end time the moment the app
  // is foregrounded again, so "zuverlässiges Verhalten bei App-Wechsel" holds instead of showing
  // a stale countdown until the next tick eventually catches up (or never, if heavily throttled).
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncFromClock();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [syncFromClock]);

  const handleStart = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    unlockAudio();
    start(Math.round(seconds));
    setExpanded(false);
  };

  const handleResume = () => {
    unlockAudio();
    resume();
  };

  if (idle && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        aria-label="Pausen-Timer öffnen"
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-on-accent shadow-overlay transition-colors hover:bg-accent-hover"
      >
        <Timer size={22} strokeWidth={2} aria-hidden />
      </button>
    );
  }

  if (idle && expanded) {
    return (
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 w-72 rounded-2xl border border-border bg-surface p-3 shadow-overlay">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-small font-medium text-text-2">Pausen-Timer</p>
          <IconButton aria-label="Schließen" onClick={() => setExpanded(false)} className="border-transparent bg-transparent">
            <X size={18} strokeWidth={2} aria-hidden />
          </IconButton>
        </div>
        <div className="mb-2 flex gap-1">
          {PRESETS_SECONDS.map((seconds) => (
            <Button key={seconds} variant="secondary" size="sm" className="flex-1" onClick={() => handleStart(seconds)}>
              {seconds}s
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={customSeconds}
            onChange={(event) => setCustomSeconds(event.target.value)}
            aria-label="Eigene Dauer in Sekunden"
            className="h-11 w-full rounded-md border border-border-strong bg-surface-inset px-3 text-body text-text"
          />
          <Button variant="primary" onClick={() => handleStart(Number(customSeconds))}>
            Start
          </Button>
        </div>

        <div className="mt-3 max-h-[50vh] overflow-y-auto border-t border-border-subtle pt-3">
          <TimerSettingsForm />
        </div>
      </div>
    );
  }

  const progress = totalSeconds > 0 ? Math.min(1, 1 - remainingSeconds / totalSeconds) : 0;

  return (
    <div
      role="timer"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t-2 bg-bg-sidebar pb-[env(safe-area-inset-bottom)] shadow-overlay",
        finished ? "animate-pulse border-accent" : "border-accent-border",
      )}
    >
      <ProgressBar value={finished ? 100 : progress * 100} size={6} label="Satzpause" className="rounded-none" />
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-overline uppercase text-text-subtle">
            {finished ? "Pause vorbei – nächster Satz!" : (label ?? "Satzpause")}
          </p>
          <p className={cn("tabular font-mono text-timer", finished ? "text-accent" : "text-text")}>
            {formatTime(remainingSeconds)}
          </p>
        </div>
        {finished ? (
          <Button variant="primary" size="lg" onClick={reset}>
            Weiter
          </Button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="primary"
              size="lg"
              aria-label={isRunning ? "Pausieren" : "Fortsetzen"}
              onClick={isRunning ? pause : handleResume}
              iconLeft={isRunning ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            >
              {isRunning ? "Pause" : "Weiter"}
            </Button>
            <Button variant="secondary" size="lg" aria-label="Überspringen" onClick={reset}>
              Überspringen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
