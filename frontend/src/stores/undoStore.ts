import { create } from "zustand";

export interface UndoToast {
  id: string;
  message: string;
}

interface UndoState {
  toasts: UndoToast[];
  /** Ids of records that are hidden in the UI while their deletion waits for the undo window. */
  pendingIds: Set<string>;
  /** Hides `recordId` now and runs `commit` after the undo window unless `undo` is called first. */
  scheduleDelete: (recordId: string, message: string, commit: () => Promise<unknown>) => void;
  undo: (recordId: string) => void;
}

export const UNDO_WINDOW_MS = 5000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function without<T>(items: Set<T>, item: T): Set<T> {
  const next = new Set(items);
  next.delete(item);
  return next;
}

// A destructive action that can be taken back for a few seconds. The record disappears from the
// list right away, but the server only hears about it once the window has passed — so "undo" is
// just showing the record again, with nothing to restore. The timer lives here (not in the
// component that started it), so leaving the page doesn't lose the delete. Closing the app inside
// the window drops it, which errs on the side of keeping the data.
export const useUndoStore = create<UndoState>((set, get) => ({
  toasts: [],
  pendingIds: new Set(),
  scheduleDelete: (recordId, message, commit) => {
    if (timers.has(recordId)) return;
    set({ toasts: [...get().toasts, { id: recordId, message }], pendingIds: new Set(get().pendingIds).add(recordId) });
    timers.set(
      recordId,
      setTimeout(() => {
        timers.delete(recordId);
        set({ toasts: get().toasts.filter((t) => t.id !== recordId) });
        // The record stays hidden until the request is done; if it fails, it reappears.
        commit()
          .catch(() => undefined)
          .finally(() => set({ pendingIds: without(get().pendingIds, recordId) }));
      }, UNDO_WINDOW_MS),
    );
  },
  undo: (recordId) => {
    const timer = timers.get(recordId);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(recordId);
    set({ toasts: get().toasts.filter((t) => t.id !== recordId), pendingIds: without(get().pendingIds, recordId) });
  },
}));
