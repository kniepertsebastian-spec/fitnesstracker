import { create } from "zustand";

export interface PRToast {
  id: string;
  exerciseName: string;
  labels: string[];
}

interface PRToastState {
  toasts: PRToast[];
  showPR: (exerciseName: string, labels: string[]) => void;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 4500;

// A brief, self-dismissing toast rather than a modal or a persisted "achievements" screen — the
// roadmap explicitly wants this "motivierend, aber nicht aufdringlich" (motivating, not
// intrusive): a moment of positive feedback right after finishing the set, not something that
// interrupts the workout or needs to be tapped away.
export const usePRToastStore = create<PRToastState>((set, get) => ({
  toasts: [],
  showPR: (exerciseName, labels) => {
    if (labels.length === 0) return;
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, exerciseName, labels }] });
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
