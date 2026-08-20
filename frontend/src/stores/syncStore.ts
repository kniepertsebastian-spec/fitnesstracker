import { create } from "zustand";

interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  setOnline: (isOnline: boolean) => void;
  setPendingCount: (pendingCount: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
}));
