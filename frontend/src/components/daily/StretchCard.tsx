import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Play, SkipForward, Square } from "lucide-react";
import { STRETCH_FOCUS_LABELS, STRETCH_FOCUS_MUSCLES, type StretchFocusMuscle, type StretchItemDto } from "@fitnesstracker/shared";
import { useDailyStretch } from "../../hooks/useStretching";
import { loadStretchDone, loadStretchFocus, saveStretchFocus, stretchDoneKey } from "../../lib/stretchStorage";
import { Button, Card, ProgressBar, SegmentedControl, Skeleton, cn } from "../ui";

const FOCUS_OPTIONS = [
  { value: "", label: "Ganzkörper" },
  ...STRETCH_FOCUS_MUSCLES.map((m) => ({ value: m as string, label: STRETCH_FOCUS_LABELS[m] })),
];

function Routine({ items, focus }: { items: StretchItemDto[]; focus: StretchFocusMuscle | null }) {
  const storageKey = stretchDoneKey(focus);
  const [done, setDone] = useState<string[]>(() => loadStretchDone(storageKey));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const advance = useRef<(markDone: boolean) => void>(() => undefined);

  const persist = (next: string[]) => {
    setDone(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // storage unavailable — still works for this visit
    }
  };

  const duration = (item: StretchItemDto) => item.holdSeconds * item.sets;

  const startItem = (item: StretchItemDto | undefined) => {
    if (!item) {
      setActiveId(null);
      return;
    }
    setActiveId(item.exerciseId);
    setRemaining(duration(item));
  };

  advance.current = (markDone) => {
    const current = items.find((i) => i.exerciseId === activeId);
    const nextDone = current && markDone ? [...new Set([...done, current.exerciseId])] : done;
    if (nextDone !== done) persist(nextDone);
    const idx = items.findIndex((i) => i.exerciseId === activeId);
    startItem(items.slice(idx + 1).find((i) => !nextDone.includes(i.exerciseId)));
  };

  useEffect(() => {
    if (!activeId) return;
    if (remaining <= 0) {
      advance.current(true);
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [activeId, remaining]);

  const toggle = (id: string) =>
    persist(done.includes(id) ? done.filter((x) => x !== id) : [...done, id]);

  const completed = items.filter((i) => done.includes(i.exerciseId)).length;
  const active = items.find((i) => i.exerciseId === activeId);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="tabular text-small text-text-subtle">
          {completed} von {items.length} erledigt
        </span>
        {active ? (
          <Button size="sm" variant="ghost" iconLeft={<Square size={14} aria-hidden />} onClick={() => setActiveId(null)}>
            Beenden
          </Button>
        ) : (
          <Button
            variant="primary"
            iconLeft={<Play size={16} aria-hidden />}
            disabled={completed === items.length}
            onClick={() => startItem(items.find((i) => !done.includes(i.exerciseId)))}
          >
            Routine starten
          </Button>
        )}
      </div>

      {active && (
        <div className="mb-3 rounded-xl border border-accent-border bg-accent-soft p-3">
          <p className="text-overline uppercase text-accent">Jetzt</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-body font-medium text-text">{active.name}</p>
            <p role="timer" aria-label="Restzeit" className="tabular font-mono text-h2 text-text">
              {remaining}s
            </p>
          </div>
          <ProgressBar className="mt-2" value={(1 - remaining / duration(active)) * 100} label="Dehnübung" />
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            iconLeft={<SkipForward size={14} aria-hidden />}
            onClick={() => advance.current(false)}
          >
            Überspringen
          </Button>
        </div>
      )}

      <div>
        {items.map((item) => {
          const isDone = done.includes(item.exerciseId);
          return (
            <button
              key={item.exerciseId}
              type="button"
              aria-pressed={isDone}
              onClick={() => toggle(item.exerciseId)}
              className={cn(
                "flex min-h-[60px] w-full items-center gap-3 border-t border-border-subtle py-2 text-left first:border-t-0",
                item.exerciseId === activeId && "bg-surface-2",
              )}
            >
              {item.imageUrls[0] ? (
                <img src={item.imageUrls[0]} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md bg-track object-cover" />
              ) : (
                <span className="h-11 w-11 shrink-0 rounded-md bg-track" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-body font-medium", isDone ? "text-text-subtle line-through" : "text-text")}>
                  {item.name}
                </span>
                <span className="block truncate text-xs text-text-faint">{item.primaryMuscles[0] ?? ""}</span>
              </span>
              <span className="tabular shrink-0 font-mono text-small text-text-2">
                {item.sets > 1 ? `${item.sets} × ` : ""}
                {item.holdSeconds}s
              </span>
              <span
                aria-hidden
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  isDone ? "border-accent bg-accent text-on-accent" : "border-border-strong",
                )}
              >
                {isDone && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Daily stretch routine: pick a focus (default: full body), get a short routine for it, tick it
// off or run it through with per-exercise countdowns. Same routine all day.
export function StretchCard() {
  const [focus, setFocus] = useState<StretchFocusMuscle | null>(loadStretchFocus);
  const { data, isLoading } = useDailyStretch(focus);

  const changeFocus = (value: string) => {
    const next = STRETCH_FOCUS_MUSCLES.find((m) => m === value) ?? null;
    setFocus(next);
    saveStretchFocus(next);
  };

  return (
    <Card
      title="Dehnroutine"
      action={
        <Link to="/stretching" className="text-small text-accent hover:text-accent-hover">
          Dehnpläne
        </Link>
      }
    >
      <div className="mb-4 max-w-full">
        <SegmentedControl label="Fokus der Dehnroutine" value={focus ?? ""} onChange={changeFocus} options={FOCUS_OPTIONS} />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.items.length === 0 ? (
        <p className="text-small text-text-subtle">
          {data && !data.catalogAvailable
            ? "Keine Dehnübungen im Katalog — importiere zuerst den Übungskatalog (Menü „Übungen“)."
            : "Keine passenden Dehnübungen gefunden."}
        </p>
      ) : (
        <Routine key={focus ?? "all"} items={data.items} focus={focus} />
      )}
    </Card>
  );
}
