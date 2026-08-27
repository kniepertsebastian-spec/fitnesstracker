import { create } from "zustand";
import { persist } from "zustand/middleware";
import { playTimerEndSound } from "../lib/timerSound";

const DEFAULT_AUTO_START_SECONDS = 90;

interface TimerState {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  // Whether saving a new set should start the timer automatically, and for how long — a pure
  // per-device UI preference, not account data, so it's persisted to localStorage rather than
  // synced through the backend.
  autoStartEnabled: boolean;
  autoStartSeconds: number;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setAutoStart: (enabled: boolean, seconds?: number) => void;
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
      function tick() {
        const { remainingSeconds } = get();
        if (remainingSeconds <= 1) {
          clearTick();
          set({ remainingSeconds: 0, isRunning: false });
          playTimerEndSound();
          navigator.vibrate?.([200, 100, 200]);
        } else {
          set({ remainingSeconds: remainingSeconds - 1 });
        }
      }

      function runTicking() {
        clearTick();
        intervalId = setInterval(tick, 1000);
      }

      return {
        remainingSeconds: 0,
        totalSeconds: 0,
        isRunning: false,
        autoStartEnabled: false,
        autoStartSeconds: DEFAULT_AUTO_START_SECONDS,

        start: (seconds) => {
          set({ totalSeconds: seconds, remainingSeconds: seconds, isRunning: true });
          runTicking();
        },

        pause: () => {
          clearTick();
          set({ isRunning: false });
        },

        resume: () => {
          if (get().remainingSeconds <= 0) return;
          set({ isRunning: true });
          runTicking();
        },

        reset: () => {
          clearTick();
          set({ remainingSeconds: 0, totalSeconds: 0, isRunning: false });
        },

        setAutoStart: (enabled, seconds) => {
          set({
            autoStartEnabled: enabled,
            ...(seconds !== undefined && Number.isFinite(seconds) && seconds > 0
              ? { autoStartSeconds: Math.round(seconds) }
              : {}),
          });
        },
      };
    },
    {
      name: "fitnesstracker-rest-timer",
      // Only the preference survives a reload — a running countdown/interval can't (and
      // shouldn't try to) resume across a page reload.
      partialize: (state) => ({
        autoStartEnabled: state.autoStartEnabled,
        autoStartSeconds: state.autoStartSeconds,
      }),
    },
  ),
);
