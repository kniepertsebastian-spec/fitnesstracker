import { useEffect, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import type { WorkoutSessionStatus } from "@fitnesstracker/shared";
import { formatDuration } from "../../lib/trainingSets";
import { SyncStatusIndicator } from "../layout/SyncStatusIndicator";
import { IconButton, SegmentedProgress } from "../ui";
import type { SegmentState } from "../ui";

function useElapsedSeconds(startedAt: string, frozenAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (frozenAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [frozenAt]);
  const end = frozenAt ? new Date(frozenAt).getTime() : now;
  return (end - new Date(startedAt).getTime()) / 1000;
}

interface Props {
  title: string;
  subtitle: string;
  startedAt: string;
  status: WorkoutSessionStatus;
  pausedAt: string | null;
  segments: SegmentState[];
  exerciseIndex: number;
  exerciseCount: number;
  setsDone: number;
  setsTotal: number;
  onLeave: () => void;
  onTogglePause: () => void;
}

export function FocusBar({
  title,
  subtitle,
  startedAt,
  status,
  pausedAt,
  segments,
  exerciseIndex,
  exerciseCount,
  setsDone,
  setsTotal,
  onLeave,
  onTogglePause,
}: Props) {
  const paused = status === "PAUSED";
  const elapsed = useElapsedSeconds(startedAt, paused ? pausedAt : null);

  return (
    <header className="border-b border-border bg-bg-sidebar pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
        <IconButton aria-label="Training verlassen" onClick={onLeave}>
          <X size={20} strokeWidth={2} aria-hidden />
        </IconButton>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-text">{title}</p>
          <p className="truncate text-xs text-text-subtle">{subtitle}</p>
        </div>
        <p
          role="timer"
          aria-label="Trainingsdauer"
          className="tabular font-mono text-h2 text-text"
        >
          {formatDuration(elapsed)}
        </p>
        <IconButton
          aria-label={paused ? "Training fortsetzen" : "Training pausieren"}
          onClick={onTogglePause}
        >
          {paused ? <Play size={20} aria-hidden /> : <Pause size={20} aria-hidden />}
        </IconButton>
      </div>
      <div className="mx-auto max-w-2xl px-4 pb-3">
        <SegmentedProgress segments={segments} size={8} label="Fortschritt im Training" />
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-text-subtle">
          <span>
            Übung {exerciseIndex + 1} von {exerciseCount}
          </span>
          <span className="tabular">
            {setsDone} von {setsTotal} Sätzen
          </span>
          {/* Sync state stays visible during a workout (P0.3) — the shell's pill is not mounted here. */}
          <SyncStatusIndicator />
        </div>
      </div>
    </header>
  );
}
