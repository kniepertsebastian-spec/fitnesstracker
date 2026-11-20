import { STRETCH_FOCUS_MUSCLES, type StretchChoice } from "@fitnesstracker/shared";

// Per-device stretch preferences/progress (localStorage) shared by the Daily page and the
// dashboard checklist — one place for the key format so both read the same state.
const FOCUS_KEY = "stretch-focus";

// Default: the routine that fits today's challenge. Someone who picked "Ganzkörper" before this
// existed had nothing stored and now gets "auto" until they pick again — nothing is lost by that.
export function loadStretchFocus(): StretchChoice {
  try {
    const stored = localStorage.getItem(FOCUS_KEY);
    if (stored === "all") return "all";
    return STRETCH_FOCUS_MUSCLES.find((m) => m === stored) ?? "auto";
  } catch {
    return "auto";
  }
}

export function saveStretchFocus(choice: StretchChoice) {
  try {
    localStorage.setItem(FOCUS_KEY, choice);
  } catch {
    // not persisted, still applies for this visit
  }
}

// "Neu mischen" counter of the day: a new pick instead of the stable one, and fresh checkmarks.
const shuffleKey = (now: Date) => `stretch-shuffle:${now.toISOString().slice(0, 10)}`;

export function loadStretchShuffle(now = new Date()): number {
  try {
    const n = Number(localStorage.getItem(shuffleKey(now)));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveStretchShuffle(value: number, now = new Date()) {
  try {
    localStorage.setItem(shuffleKey(now), String(value));
  } catch {
    // not persisted, still applies for this visit
  }
}

export function stretchDoneKey(choice: StretchChoice, shuffle = 0, now = new Date()): string {
  return `stretch-done:${now.toISOString().slice(0, 10)}:${choice === "all" ? "all" : choice}${shuffle > 0 ? `:s${shuffle}` : ""}`;
}

export function loadStretchDone(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
