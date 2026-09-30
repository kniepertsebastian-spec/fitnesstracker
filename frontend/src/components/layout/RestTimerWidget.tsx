import { useEffect, useState } from "react";
import { useTimerStore } from "../../stores/timerStore";
import { unlockAudio } from "../../lib/timerSound";
import { TimerSettingsForm } from "../settings/TimerSettingsForm";

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
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-violet-500 text-lg text-ink-950 shadow-lg hover:bg-violet-400"
      >
        ⏱
      </button>
    );
  }

  if (idle && expanded) {
    return (
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 w-72 rounded-xl border border-ink-800 bg-ink-900 p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-ink-200">Pausen-Timer</p>
          <button
            onClick={() => setExpanded(false)}
            aria-label="Schließen"
            className="text-ink-500 hover:text-ink-200"
          >
            ✕
          </button>
        </div>
        <div className="mb-2 flex gap-1">
          {PRESETS_SECONDS.map((seconds) => (
            <button
              key={seconds}
              onClick={() => handleStart(seconds)}
              className="flex-1 rounded-lg bg-ink-800 py-1.5 text-sm text-ink-200 hover:bg-ink-700"
            >
              {seconds}s
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={customSeconds}
            onChange={(event) => setCustomSeconds(event.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => handleStart(Number(customSeconds))}
            className="shrink-0 rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-violet-400"
          >
            Start
          </button>
        </div>

        <div className="mt-3 max-h-[50vh] overflow-y-auto border-t border-ink-800 pt-3">
          <TimerSettingsForm />
        </div>
      </div>
    );
  }

  const progress = totalSeconds > 0 ? Math.min(1, 1 - remainingSeconds / totalSeconds) : 0;

  return (
    <div
      role="timer"
      className={`fixed inset-x-0 bottom-0 z-40 border-t-2 bg-ink-900 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.5)] ${
        finished ? "animate-pulse border-emerald-400" : "border-violet-500"
      }`}
    >
      <div className="h-1.5 w-full bg-ink-800">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${finished ? "bg-emerald-400" : "bg-violet-500"}`}
          style={{ width: `${finished ? 100 : progress * 100}%` }}
        />
      </div>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-ink-400">
            {finished ? "Pause vorbei – nächster Satz!" : (label ?? "Satzpause")}
          </p>
          <p
            className={`font-mono text-5xl font-bold leading-none tabular-nums ${
              finished ? "text-emerald-400" : "text-ink-50"
            }`}
          >
            {formatTime(remainingSeconds)}
          </p>
        </div>
        {finished ? (
          <button
            onClick={reset}
            className="rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-ink-950 hover:bg-emerald-400"
          >
            Weiter
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={isRunning ? pause : handleResume}
              aria-label={isRunning ? "Pausieren" : "Fortsetzen"}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500 text-xl text-ink-950 hover:bg-violet-400"
            >
              {isRunning ? "⏸" : "▶"}
            </button>
            <button
              onClick={reset}
              aria-label="Überspringen"
              className="flex h-12 items-center justify-center rounded-full bg-ink-800 px-4 text-sm text-ink-200 hover:bg-ink-700"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
