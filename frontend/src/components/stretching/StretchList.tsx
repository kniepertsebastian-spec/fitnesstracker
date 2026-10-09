import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Play, Square } from "lucide-react";
import type { StretchItemDto } from "@fitnesstracker/shared";
import { loadStretchDone } from "../../lib/stretchStorage";
import { Button, ProgressBar, cn } from "../ui";

function HoldTimer({ seconds, onFinished }: { seconds: number; onFinished: () => void }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      setRemaining(null);
      finished.current();
      return;
    }
    const id = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  if (remaining === null) {
    return (
      <Button size="sm" variant="secondary" iconLeft={<Play size={14} aria-hidden />} onClick={() => setRemaining(seconds)}>
        {seconds}s halten
      </Button>
    );
  }
  return (
    <Button size="sm" variant="primary" iconLeft={<Square size={14} aria-hidden />} onClick={() => setRemaining(null)}>
      {remaining}s · Stopp
    </Button>
  );
}

interface Props {
  items: StretchItemDto[];
  // Scope for the persisted checkmarks; omit to disable persistence of "done" state.
  storageKey: string;
  // F9: lets the training view show stretching progress in its focus bar.
  onDoneChange?: (doneIds: string[]) => void;
}

// Per-device "done" marks, keyed by a caller-chosen scope (e.g. the date) — a stretch session is
// a casual tick-off list, not data worth a table or offline-sync queue.
export function StretchList({ items, storageKey, onDoneChange }: Props) {
  const [done, setDone] = useState<string[]>(() => loadStretchDone(storageKey));
  const [expanded, setExpanded] = useState<string | null>(null);
  const reportDone = useRef(onDoneChange);
  reportDone.current = onDoneChange;
  useEffect(() => {
    reportDone.current?.(done);
  }, [done]);

  const toggle = (id: string, value?: boolean) => {
    setDone((current) => {
      const isDone = current.includes(id);
      const next = (value ?? !isDone) ? [...new Set([...current, id])] : current.filter((x) => x !== id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable — the in-memory state still works for this visit
      }
      return next;
    });
  };

  const doneCount = items.filter((i) => done.includes(i.exerciseId)).length;

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center gap-3">
        <ProgressBar value={(doneCount / items.length) * 100} label="Dehnübungen erledigt" />
        <span className="tabular shrink-0 text-small text-text-subtle">
          {doneCount} von {items.length}
        </span>
      </div>
      {items.map((item) => {
        const isDone = done.includes(item.exerciseId);
        const isOpen = expanded === item.exerciseId;
        return (
          <div key={item.exerciseId} className="border-t border-border-subtle py-2 first:border-t-0">
            <div className="flex min-h-[52px] items-center gap-3">
              <button
                type="button"
                aria-pressed={isDone}
                aria-label={`${item.name} erledigt`}
                onClick={() => toggle(item.exerciseId)}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  isDone ? "border-accent bg-accent text-on-accent" : "border-border-strong",
                )}
              >
                {isDone && <Check size={14} strokeWidth={3} aria-hidden />}
              </button>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpanded(isOpen ? null : item.exerciseId)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1 text-left text-body",
                  isDone ? "text-text-faint line-through" : "text-text-2",
                )}
              >
                <span className="truncate">{item.name}</span>
                <ChevronDown size={14} aria-hidden className={cn("shrink-0 transition-transform", isOpen && "rotate-180")} />
              </button>
              <span className="tabular shrink-0 font-mono text-small text-text-faint">
                {item.sets > 1 ? `${item.sets} × ` : ""}
                {item.holdSeconds}s
              </span>
              <HoldTimer seconds={item.holdSeconds} onFinished={() => toggle(item.exerciseId, true)} />
            </div>
            {isOpen && (
              <div className="mt-2 flex flex-col gap-2 text-small text-text-subtle">
                {item.imageUrls.length > 0 && (
                  // Start/end position side by side, each at its natural aspect ratio — a
                  // full-width stretch distorts the source photos.
                  <div className="flex gap-2">
                    {item.imageUrls.slice(0, 2).map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt={item.name}
                        loading="lazy"
                        className="aspect-[4/3] min-w-0 flex-1 rounded-lg bg-track object-contain sm:max-w-[16rem]"
                      />
                    ))}
                  </div>
                )}
                {item.description && <p className="whitespace-pre-line">{item.description}</p>}
                <Link to={`/exercises/${item.exerciseId}`} className="text-accent hover:text-accent-hover">
                  Zur Übung
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
