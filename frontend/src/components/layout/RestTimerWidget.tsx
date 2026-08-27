import { useState } from "react";
import { useTimerStore } from "../../stores/timerStore";
import { unlockAudio } from "../../lib/timerSound";

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
    autoStartEnabled,
    autoStartSeconds,
    setAutoStart,
  } = useTimerStore();
  const [expanded, setExpanded] = useState(false);
  const [customSeconds, setCustomSeconds] = useState("90");

  const idle = totalSeconds === 0;
  const finished = !idle && remainingSeconds === 0;

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
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 w-64 rounded-xl border border-ink-800 bg-ink-900 p-3 shadow-lg">
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

        <label className="mt-3 flex items-center justify-between border-t border-ink-800 pt-3 text-sm text-ink-300">
          <span>Automatisch nach jedem Satz starten</span>
          <input
            type="checkbox"
            checked={autoStartEnabled}
            onChange={(event) => setAutoStart(event.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
        </label>
        {autoStartEnabled && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-ink-500">Dauer</span>
            <input
              type="number"
              min={1}
              value={autoStartSeconds}
              onChange={(event) => setAutoStart(true, Number(event.target.value))}
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1 text-sm"
            />
            <span className="text-xs text-ink-500">s</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 flex items-center gap-2 rounded-full border border-ink-800 bg-ink-900 py-2 pl-4 pr-2 shadow-lg">
      <span
        className={`font-mono text-lg tabular-nums ${finished ? "text-emerald-400" : "text-ink-100"}`}
      >
        {formatTime(remainingSeconds)}
      </span>
      {finished ? (
        <button
          onClick={reset}
          className="rounded-full bg-ink-800 px-3 py-1.5 text-sm text-ink-200 hover:bg-ink-700"
        >
          Fertig
        </button>
      ) : (
        <>
          <button
            onClick={isRunning ? pause : handleResume}
            aria-label={isRunning ? "Pausieren" : "Fortsetzen"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-ink-200 hover:bg-ink-700"
          >
            {isRunning ? "⏸" : "▶"}
          </button>
          <button
            onClick={reset}
            aria-label="Zurücksetzen"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-ink-200 hover:bg-ink-700"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
