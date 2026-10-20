import { lazy, Suspense, useEffect, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { UpdatePrompt } from "./components/layout/UpdatePrompt";
import { useAuthBootstrap } from "./hooks/useAuth";
import { initWorkoutLogSync } from "./offline/workoutLogSync";
import { initWorkoutSessionSync } from "./offline/workoutSessionSync";
import { initCardioLogSync } from "./offline/cardioLogSync";
import { initPlanEditSync } from "./offline/planEditSync";
import { initRestTimerPush } from "./lib/restTimerPush";
import { requestPersistentStorage } from "./lib/persistentStorage";
import { useAuthStore } from "./stores/authStore";
import { useSyncStore } from "./stores/syncStore";
import { useOpenWorkoutSession } from "./hooks/useWorkoutSession";
import { updateAppBadge } from "./lib/appBadge";

// Every screen is its own chunk, so a signed-in cold start doesn't download (or parse) the code
// of the other fifteen — the JS of the whole app used to arrive as one 800 KB file, even for the
// login page. The pages are named exports, hence the small adapter.
function lazyPage<T extends Record<string, ComponentType>>(load: () => Promise<T>, name: keyof T & string) {
  return lazy(() => load().then((module) => ({ default: module[name] })));
}

const LoginPage = lazyPage(() => import("./routes/LoginPage"), "LoginPage");
const RegisterPage = lazyPage(() => import("./routes/RegisterPage"), "RegisterPage");
const DashboardPage = lazyPage(() => import("./routes/DashboardPage"), "DashboardPage");
const DailyPage = lazyPage(() => import("./routes/DailyPage"), "DailyPage");
const DiaryPage = lazyPage(() => import("./routes/DiaryPage"), "DiaryPage");
const WorkoutHistoryPage = lazyPage(() => import("./routes/WorkoutHistoryPage"), "WorkoutHistoryPage");
const ExerciseLibraryPage = lazyPage(() => import("./routes/ExerciseLibraryPage"), "ExerciseLibraryPage");
const ExerciseDetailPage = lazyPage(() => import("./routes/ExerciseDetailPage"), "ExerciseDetailPage");
const TrainingPlanPage = lazyPage(() => import("./routes/TrainingPlanPage"), "TrainingPlanPage");
const PlanGenerateExportPage = lazyPage(() => import("./routes/PlanGenerateExportPage"), "PlanGenerateExportPage");
const StretchingPage = lazyPage(() => import("./routes/StretchingPage"), "StretchingPage");
const GoalsPage = lazyPage(() => import("./routes/GoalsPage"), "GoalsPage");
const NutritionPage = lazyPage(() => import("./routes/NutritionPage"), "NutritionPage");
const ProgressPage = lazyPage(() => import("./routes/ProgressPage"), "ProgressPage");
const SettingsPage = lazyPage(() => import("./routes/SettingsPage"), "SettingsPage");
const TrainingPage = lazyPage(() => import("./routes/TrainingPage"), "TrainingPage");
// Dev-only: the ternary is folded away in production builds, so the chunk isn't emitted.
const UiKitPage = import.meta.env.DEV ? lazyPage(() => import("./routes/UiKitPage"), "UiKitPage") : null;

// Shown while the first chunk of a screen loads (cold start); same look as ProtectedRoute's wait.
function RouteFallback() {
  return <div className="min-h-screen bg-bg p-4 text-text-subtle">Lädt…</div>;
}

// A screen that fails to render or to load (a stale chunk after a deploy, a dropped connection)
// shows a message with a way out instead of blanking the app.
function RoutedScreens({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary resetKey={pathname}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

// No reload prompt while a workout is in focus mode (/training) — it appears right after.
function GlobalUpdatePrompt() {
  const { pathname } = useLocation();
  return <UpdatePrompt suppressed={pathname.startsWith("/training")} />;
}

// Mirrors unsynced changes / an open session onto the installed app's icon badge.
function AppBadge() {
  const authenticated = useAuthStore((s) => s.status === "authenticated");
  const pending = useSyncStore((s) => s.pendingCount + s.failedCount);
  const { data: session } = useOpenWorkoutSession();
  useEffect(() => {
    updateAppBadge(authenticated ? pending : 0, authenticated && !!session);
  }, [authenticated, pending, session]);
  return null;
}

export function App() {
  useAuthBootstrap();
  const authStatus = useAuthStore((s) => s.status);
  // Once someone is signed in there is data worth protecting from browser eviction.
  useEffect(() => {
    if (authStatus === "authenticated") void requestPersistentStorage();
  }, [authStatus]);
  useEffect(() => initWorkoutLogSync(), []);
  useEffect(() => initWorkoutSessionSync(), []);
  useEffect(() => initCardioLogSync(), []);
  useEffect(() => initPlanEditSync(), []);
  useEffect(() => initRestTimerPush(), []);

  return (
    // v7_startTransition: a navigation to a page whose chunk isn't loaded yet keeps the current
    // page on screen until it arrives, instead of blanking it with the Suspense fallback.
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <GlobalUpdatePrompt />
      <AppBadge />
      <RoutedScreens>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/training"
            element={
              <ProtectedRoute>
                <TrainingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily"
            element={
              <ProtectedRoute>
                <DailyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/diary"
            element={
              <ProtectedRoute>
                <DiaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <WorkoutHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <ExerciseLibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises/:id"
            element={
              <ProtectedRoute>
                <ExerciseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan"
            element={
              <ProtectedRoute>
                <TrainingPlanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/plan/generate"
            element={
              <ProtectedRoute>
                <PlanGenerateExportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stretching"
            element={
              <ProtectedRoute>
                <StretchingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/goals"
            element={
              <ProtectedRoute>
                <GoalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/nutrition"
            element={
              <ProtectedRoute>
                <NutritionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <ProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {UiKitPage && <Route path="/ui" element={<UiKitPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RoutedScreens>
    </BrowserRouter>
  );
}
