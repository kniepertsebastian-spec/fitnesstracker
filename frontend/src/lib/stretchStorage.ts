import { STRETCH_FOCUS_MUSCLES, type StretchFocusMuscle } from "@fitnesstracker/shared";

// Per-device stretch preferences/progress (localStorage) shared by the Daily page and the
// dashboard checklist — one place for the key format so both read the same state.
const FOCUS_KEY = "stretch-focus";

export function loadStretchFocus(): StretchFocusMuscle | null {
  try {
    const stored = localStorage.getItem(FOCUS_KEY);
    return STRETCH_FOCUS_MUSCLES.find((m) => m === stored) ?? null;
  } catch {
    return null;
  }
}

export function saveStretchFocus(focus: StretchFocusMuscle | null) {
  try {
    if (focus) localStorage.setItem(FOCUS_KEY, focus);
    else localStorage.removeItem(FOCUS_KEY);
  } catch {
    // not persisted, still applies for this visit
  }
}

export function stretchDoneKey(focus: StretchFocusMuscle | null, now = new Date()): string {
  return `stretch-done:${now.toISOString().slice(0, 10)}:${focus ?? "all"}`;
}

export function loadStretchDone(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
