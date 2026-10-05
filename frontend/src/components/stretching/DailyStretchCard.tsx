import { useState } from "react";
import { Link } from "react-router-dom";
import { STRETCH_FOCUS_LABELS, STRETCH_FOCUS_MUSCLES, type StretchFocusMuscle } from "@fitnesstracker/shared";
import { useDailyStretch } from "../../hooks/useStretching";
import { StretchList } from "./StretchList";

const FOCUS_KEY = "stretch-focus";

function loadFocus(): StretchFocusMuscle | null {
  try {
    const stored = localStorage.getItem(FOCUS_KEY);
    return STRETCH_FOCUS_MUSCLES.find((m) => m === stored) ?? null;
  } catch {
    return null;
  }
}

// Daily stretch routine next to the Tages-Challenge: pick a focus (e.g. Schultern) and get a
// short routine for that area; no focus = a quick full-body round. Same routine all day.
export function DailyStretchCard() {
  const [focus, setFocus] = useState<StretchFocusMuscle | null>(loadFocus);
  const { data, isLoading } = useDailyStretch(focus);
  const today = new Date().toISOString().slice(0, 10);

  const changeFocus = (value: string) => {
    const next = STRETCH_FOCUS_MUSCLES.find((m) => m === value) ?? null;
    setFocus(next);
    try {
      if (next) localStorage.setItem(FOCUS_KEY, next);
      else localStorage.removeItem(FOCUS_KEY);
    } catch {
      // not persisted, still applies for this visit
    }
  };

  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-300">Tägliche Dehnroutine</p>
        <Link to="/stretching" className="text-xs text-violet-400 hover:underline">
          Dehnpläne
        </Link>
      </div>
      <label className="mb-3 flex items-center gap-2 text-xs text-ink-500">
        Fokus
        <select
          value={focus ?? ""}
          onChange={(e) => changeFocus(e.target.value)}
          className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-1 text-sm text-ink-200"
        >
          <option value="">Ganzkörper</option>
          {STRETCH_FOCUS_MUSCLES.map((m) => (
            <option key={m} value={m}>
              {STRETCH_FOCUS_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      {isLoading ? (
        <p className="text-sm text-ink-500">Lädt…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-ink-500">
          {data && !data.catalogAvailable
            ? "Keine Dehnübungen im Katalog — importiere zuerst den Übungskatalog (Menü „Übungen“)."
            : "Keine passenden Dehnübungen gefunden."}
        </p>
      ) : (
        <StretchList key={`${focus ?? "all"}`} items={data.items} storageKey={`stretch-done:${today}:${focus ?? "all"}`} />
      )}
    </div>
  );
}
