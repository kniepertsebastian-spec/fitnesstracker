import { create } from "zustand";

interface StorageNoticeState {
  // The message currently shown, or null. One notice at a time: a second full write while it is
  // still on screen says nothing new.
  message: string | null;
  show: (message: string) => void;
  dismiss: () => void;
}

// "Speicher voll" (offline/storageQuota.ts) as a toast instead of window.alert: an alert blocks the
// whole page — mid-workout, with the rest timer running — until it is tapped away. The toast stays
// until the user closes it, since the entry it reports was not saved.
export const useStorageNoticeStore = create<StorageNoticeState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  dismiss: () => set({ message: null }),
}));
