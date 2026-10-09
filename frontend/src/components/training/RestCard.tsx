import { Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { useTimerStore } from "../../stores/timerStore";
import { unlockAudio } from "../../lib/timerSound";
import { formatDuration } from "../../lib/trainingSets";
import { Button, Card, ProgressBar, cn } from "../ui";

// Satzpause as a card under the exercise (instead of the floating widget). The countdown logic —
// absolute end time, visibility sync — stays in timerStore; this only renders it.
export function RestCard() {
  const {
    remainingSeconds,
    totalSeconds,
    isRunning,
    label,
    soundEnabled,
    vibrationEnabled,
    pause,
    resume,
    reset,
    adjust,
    syncFromClock,
    setSoundEnabled,
    setVibrationEnabled,
  } = useTimerStore();

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") syncFromClock();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [syncFromClock]);

  if (totalSeconds === 0) return null;

  const finished = remainingSeconds === 0;
  const alertsOn = soundEnabled || vibrationEnabled;
  const progress = finished ? 100 : (1 - remainingSeconds / totalSeconds) * 100;

  const toggleAlerts = () => {
    unlockAudio();
    setSoundEnabled(!alertsOn);
    setVibrationEnabled(!alertsOn);
  };

  return (
    <Card role="timer" aria-label="Satzpause" className={cn(finished && "border-accent-border")}>
      <p className={cn("text-overline uppercase", finished ? "text-accent" : "text-text-subtle")}>
        {finished ? "Pause vorbei – nächster Satz" : "Satzpause"}
      </p>
      <p className="mt-1 truncate text-xs text-text-faint">{label}</p>
      <p className={cn("tabular my-2 font-mono text-timer", finished ? "text-accent" : "text-text")}>
        {formatDuration(remainingSeconds)}
      </p>
      <ProgressBar value={progress} size={6} label="Satzpause" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!finished && (
          <>
            <Button size="sm" variant="secondary" onClick={() => adjust(-15)} disabled={!isRunning}>
              −15
            </Button>
            <Button size="sm" variant="secondary" onClick={() => adjust(15)} disabled={!isRunning}>
              +15
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                unlockAudio();
                if (isRunning) pause();
                else resume();
              }}
            >
              {isRunning ? "Pausieren" : "Fortsetzen"}
            </Button>
          </>
        )}
        <Button size="sm" variant={finished ? "primary" : "ghost"} onClick={reset} className="ml-auto">
          {finished ? "Weiter" : "Überspringen"}
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-text-subtle">
        <span className="tabular">von {formatDuration(totalSeconds)}</span>
        <button
          type="button"
          onClick={toggleAlerts}
          aria-pressed={alertsOn}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 hover:text-text"
        >
          {alertsOn ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
          Ton und Vibration {alertsOn ? "an" : "aus"}
        </button>
      </div>
    </Card>
  );
}
