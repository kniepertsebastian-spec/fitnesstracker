import { create } from "zustand";
import { persist } from "zustand/middleware";
import { playTimerEndSound } from "../lib/timerSound";

const DEFAULT_AUTO_START_SECONDS = 90;

interface TimerState {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  // Absolute epoch-ms the timer finishes at while running, null otherwise. `remainingSeconds`
  // is derived from this on every tick and on demand (see syncFromClock) rather than being the
  // source of truth itself — a plain per-tick decrement drifts or stalls once the tab/app is
  // backgrounded and `setInterval` gets throttled, which is exactly when someone glancing at
  // their phone mid-rest would notice the countdown lying to them.
  endsAt: number | null;
  // Whether saving a new set should start the timer automatically, and for how long — a pure
  // per-device UI preference, not account data, so it's persisted to localStorage rather than
  // synced through the backend.
  autoStartEnabled: boolean;
  autoStartSeconds: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setAutoStart: (enabled: boolean, seconds?: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  // Recomputes remainingSeconds from `endsAt` immediately instead of waiting for the next
  // 1s interval tick — call this on a visibilitychange/focus event so returning to the app
  // after it was backgrounded shows (and, if elapsed, completes) the timer right away.
  syncFromClock: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

function clearTick() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => {
      function syncFromClock() {
        const { isRunning, endsAt, soundEnabled, vibrationEnabled } = get();
        if (!isRunning || endsAt === null) return;
        const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
        if (remaining <= 0) {
          clearTick();
          set({ remainingSeconds: 0, isRunning: false, endsAt: null });
          if (soundEnabled) playTimerEndSound();
          if (vibrationEnabled) navigator.vibrate?.([200, 100, 200]);
        } else {
          set({ remainingSeconds: remaining });
        }
      }

      function runTicking() {
        clearTick();
        intervalId = setInterval(syncFromClock, 1000);
      }

      return {
        remainingSeconds: 0,
        totalSeconds: 0,
        isRunning: false,
        endsAt: null,
        autoStartEnabled: false,
        autoStartSeconds: DEFAULT_AUTO_START_SECONDS,
        soundEnabled: true,
        vibrationEnabled: true,

        start: (seconds) => {
          set({
            totalSeconds: seconds,
            remainingSeconds: seconds,
            isRunning: true,
            endsAt: Date.now() + seconds * 1000,
          });
          runTicking();
        },

        pause: () => {
          clearTick();
          set({ isRunning: false, endsAt: null });
        },

        resume: () => {
          const { remainingSeconds } = get();
          if (remainingSeconds <= 0) return;
          set({ isRunning: true, endsAt: Date.now() + remainingSeconds * 1000 });
          runTicking();
        },

        reset: () => {
          clearTick();
          set({ remainingSeconds: 0, totalSeconds: 0, isRunning: false, endsAt: null });
        },

        setAutoStart: (enabled, seconds) => {
          set({
            autoStartEnabled: enabled,
            ...(seconds !== undefined && Number.isFinite(seconds) && seconds > 0
              ? { autoStartSeconds: Math.round(seconds) }
              : {}),
          });
        },

        setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
        setVibrationEnabled: (enabled) => set({ vibrationEnabled: enabled }),

        syncFromClock,
      };
    },
    {
      name: "fitnesstracker-rest-timer",
      // Only preferences survive a reload — a running countdown/interval can't (and shouldn't
      // try to) resume across a page reload.
      partialize: (state) => ({
        autoStartEnabled: state.autoStartEnabled,
        autoStartSeconds: state.autoStartSeconds,
        soundEnabled: state.soundEnabled,
        vibrationEnabled: state.vibrationEnabled,
      }),
    },
  ),
);
