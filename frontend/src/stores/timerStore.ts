import { create } from "zustand";
import { persist } from "zustand/middleware";
import { playTimerEndSound, type TimerSoundId } from "../lib/timerSound";

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
  soundId: TimerSoundId;
  soundVolume: number;
  soundRepeat: number;
  customSoundDataUrl: string | null;
  customSoundName: string | null;
  // Label of what the running timer is for (e.g. "Bankdrücken · Satz 2 fertig"), shown in the banner.
  label: string | null;
  start: (seconds: number, label?: string) => void;
  setSoundId: (id: TimerSoundId) => void;
  setSoundVolume: (volume: number) => void;
  setSoundRepeat: (repeat: number) => void;
  setCustomSound: (dataUrl: string | null, name: string | null) => void;
  testSound: () => void;
  // Shifts a running countdown by ±seconds (−15/+15 in the focus mode's Satzpause card).
  adjust: (deltaSeconds: number) => void;
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
      function soundOptions() {
        const { soundId, soundVolume, soundRepeat, customSoundDataUrl } = get();
        return { soundId, volume: soundVolume, repeat: soundRepeat, customSoundDataUrl };
      }

      function syncFromClock() {
        const { isRunning, endsAt, soundEnabled, vibrationEnabled } = get();
        if (!isRunning || endsAt === null) return;
        const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
        if (remaining <= 0) {
          clearTick();
          set({ remainingSeconds: 0, isRunning: false, endsAt: null });
          if (soundEnabled) playTimerEndSound(soundOptions());
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
        autoStartEnabled: true,
        autoStartSeconds: DEFAULT_AUTO_START_SECONDS,
        soundEnabled: true,
        vibrationEnabled: true,
        soundId: "mp3" as TimerSoundId,
        soundVolume: 1,
        soundRepeat: 1,
        customSoundDataUrl: null,
        customSoundName: null,
        label: null,

        start: (seconds, label) => {
          set({
            label: label ?? null,
            totalSeconds: seconds,
            remainingSeconds: seconds,
            isRunning: true,
            endsAt: Date.now() + seconds * 1000,
          });
          runTicking();
        },

        adjust: (deltaSeconds) => {
          const { isRunning, endsAt, remainingSeconds, totalSeconds } = get();
          if (!isRunning || endsAt === null) return;
          const elapsed = totalSeconds - remainingSeconds;
          const nextRemaining = Math.max(1, Math.round((endsAt - Date.now()) / 1000) + deltaSeconds);
          set({
            endsAt: Date.now() + nextRemaining * 1000,
            remainingSeconds: nextRemaining,
            totalSeconds: elapsed + nextRemaining,
          });
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
          set({ remainingSeconds: 0, totalSeconds: 0, isRunning: false, endsAt: null, label: null });
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

        setSoundId: (soundId) => set({ soundId }),
        setSoundVolume: (soundVolume) => set({ soundVolume: Math.min(1, Math.max(0, soundVolume)) }),
        setSoundRepeat: (soundRepeat) => set({ soundRepeat: Math.min(5, Math.max(1, Math.round(soundRepeat))) }),
        setCustomSound: (customSoundDataUrl, customSoundName) =>
          set({ customSoundDataUrl, customSoundName, ...(customSoundDataUrl ? { soundId: "custom" as TimerSoundId } : {}) }),
        testSound: () => playTimerEndSound(soundOptions()),

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
        soundId: state.soundId,
        soundVolume: state.soundVolume,
        soundRepeat: state.soundRepeat,
        customSoundDataUrl: state.customSoundDataUrl,
        customSoundName: state.customSoundName,
      }),
    },
  ),
);
