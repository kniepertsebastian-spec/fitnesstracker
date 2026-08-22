import { create } from "zustand";
import { playTimerEndSound } from "../lib/timerSound";

interface TimerState {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

function clearTick() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const useTimerStore = create<TimerState>((set, get) => {
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
  };
});
