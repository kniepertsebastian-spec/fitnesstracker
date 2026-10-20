import { cancelRestTimerPushRequest, scheduleRestTimerPushRequest } from "../api/push.api";
import { useTimerStore } from "../stores/timerStore";

// Mirrors the running rest timer to the server, which sends "Pause vorbei" as a push when it
// ends (roadmap3 P1.3) — on a locked phone the page's own timer is suspended and can't ring.
// Only with notification permission; failures (offline) just mean no push, the in-app timer
// still works.
function canNotify() {
  return typeof Notification !== "undefined" && Notification.permission === "granted" && "serviceWorker" in navigator;
}

let initialized = false;

export function initRestTimerPush() {
  if (initialized) return;
  initialized = true;
  let scheduledEndsAt: number | null = null;
  useTimerStore.subscribe((state) => {
    const endsAt = state.isRunning ? state.endsAt : null;
    if (endsAt === scheduledEndsAt) return;
    const hadTimer = scheduledEndsAt !== null;
    scheduledEndsAt = endsAt;
    if (!canNotify()) return;
    if (endsAt !== null) {
      void scheduleRestTimerPushRequest(new Date(endsAt).toISOString(), state.label ?? undefined).catch(() => undefined);
    } else if (hadTimer) {
      void cancelRestTimerPushRequest().catch(() => undefined);
    }
  });
}
