import { useEffect } from "react";
import { ForgottenSessionPrompt } from "../workoutLog/ForgottenSessionPrompt";
import { useOpenWorkoutSession } from "../../hooks/useWorkoutSession";
import { updateAppBadge } from "../../lib/appBadge";
import { requestPersistentStorage } from "../../lib/persistentStorage";
import { initRestTimerPush } from "../../lib/restTimerPush";
import { initCardioLogSync, flushPendingCardioLogs } from "../../offline/cardioLogSync";
import { initExerciseCatalogSync, syncExerciseCatalog } from "../../offline/exerciseCatalog";
import { flushPlanOps, initPlanEditSync } from "../../offline/planEditSync";
import { refreshSyncCounts } from "../../offline/syncCounts";
import { flushPendingMutations, initWorkoutLogSync } from "../../offline/workoutLogSync";
import { flushPendingSessionMutations, initWorkoutSessionSync } from "../../offline/workoutSessionSync";
import { useAuthStore } from "../../stores/authStore";
import { useSyncStore } from "../../stores/syncStore";
import { StorageFullToastHost } from "./StorageFullToastHost";

function flushAll() {
  void refreshSyncCounts();
  void flushPendingMutations();
  void flushPendingSessionMutations();
  void flushPendingCardioLogs();
  void flushPlanOps();
}

// Mirrors unsynced changes / an open session onto the installed app's icon badge.
function AppBadge() {
  const pending = useSyncStore((s) => s.pendingCount + s.failedCount);
  const { data: session } = useOpenWorkoutSession();
  useEffect(() => {
    updateAppBadge(pending, !!session);
  }, [pending, session]);
  // Signed out: nothing of the previous account stays on the icon.
  useEffect(() => () => updateAppBadge(0, false), []);
  return null;
}

// Everything that only matters while someone is signed in: the offline queues and their sync, the
// exercise catalog copy, persistent storage, the rest-timer push, the icon badge, the
// "Training noch aktiv?" prompt and the "Speicher voll" toast. App.tsx loads this as its own chunk and renders it only for an
// authenticated user, so the login page's first download carries none of it (Dexie included).
//
// The init* functions are idempotent and keep their listeners for the page's lifetime; after a
// logout and a new login this component mounts again and only flushes the new account's queues.
export function AuthenticatedRuntime() {
  useEffect(() => {
    void requestPersistentStorage();
    initWorkoutLogSync();
    initWorkoutSessionSync();
    initExerciseCatalogSync();
    initCardioLogSync();
    initPlanEditSync();
    initRestTimerPush();
    // The offline copy of the exercise catalog is fetched as soon as someone is signed in.
    void syncExerciseCatalog(true);
    // Queued entries belong to an account: show this account's counts and send whatever it left
    // unsynced earlier, without waiting for the timers.
    flushAll();
    // A user switch while this stays mounted, and the logout itself (counts back to zero).
    return useAuthStore.subscribe((state, previous) => {
      if (state.user?.id === previous.user?.id) return;
      if (state.user) flushAll();
      else void refreshSyncCounts();
    });
  }, []);

  return (
    <>
      <AppBadge />
      <ForgottenSessionPrompt />
      <StorageFullToastHost />
    </>
  );
}
