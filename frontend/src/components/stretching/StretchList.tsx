import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { StretchItemDto } from "@fitnesstracker/shared";

// Per-device "done" marks, keyed by a caller-chosen scope (e.g. the date) — a stretch session is
// a casual tick-off list, not data worth a table or offline-sync queue.
function loadDone(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

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
      <button
        onClick={() => setRemaining(seconds)}
        className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-text-2 hover:bg-control"
      >
        ▶ {seconds}s halten
      </button>
    );
  }
  return (
    <button
      onClick={() => setRemaining(null)}
      className="rounded-lg bg-accent px-2 py-1 text-xs font-medium text-on-accent"
    >
      {remaining}s · Stopp
    </button>
  );
}

interface Props {
  items: StretchItemDto[];
  // Scope for the persisted checkmarks; omit to disable persistence of "done" state.
  storageKey: string;
}

export function StretchList({ items, storageKey }: Props) {
  const [done, setDone] = useState<string[]>(() => loadDone(storageKey));
  const [expanded, setExpanded] = useState<string | null>(null);

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
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-faint">
        {doneCount}/{items.length} erledigt
      </p>
      {items.map((item) => {
        const isDone = done.includes(item.exerciseId);
        const isOpen = expanded === item.exerciseId;
        return (
          <div key={item.exerciseId} className="rounded-lg bg-bg p-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isDone}
                onChange={() => toggle(item.exerciseId)}
                aria-label={`${item.name} erledigt`}
                className="h-4 w-4 shrink-0 accent-accent"
              />
              <button
                onClick={() => setExpanded(isOpen ? null : item.exerciseId)}
                className={`min-w-0 flex-1 truncate text-left text-sm ${isDone ? "text-text-faint line-through" : "text-text-2"}`}
              >
                {item.name}
              </button>
              <span className="shrink-0 text-xs text-text-faint">
                {item.sets > 1 ? `${item.sets}× ` : ""}
                {item.holdSeconds}s
              </span>
              <HoldTimer seconds={item.holdSeconds} onFinished={() => toggle(item.exerciseId, true)} />
            </div>
            {isOpen && (
              <div className="mt-2 flex flex-col gap-2 text-xs text-text-subtle">
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
                        className="aspect-[4/3] min-w-0 flex-1 rounded-lg bg-surface-2 object-contain sm:max-w-[16rem]"
                      />
                    ))}
                  </div>
                )}
                {item.description && <p className="whitespace-pre-line">{item.description}</p>}
                <Link to={`/exercises/${item.exerciseId}`} className="text-accent hover:underline">
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
