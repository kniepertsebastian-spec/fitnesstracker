import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage";
import { RegisterPage } from "./routes/RegisterPage";
import { WorkoutLogPage } from "./routes/WorkoutLogPage";
import { ExerciseLibraryPage } from "./routes/ExerciseLibraryPage";
import { ExerciseDetailPage } from "./routes/ExerciseDetailPage";
import { TrainingPlanPage } from "./routes/TrainingPlanPage";
import { PlanGenerateExportPage } from "./routes/PlanGenerateExportPage";
import { GoalsPage } from "./routes/GoalsPage";
import { NutritionPage } from "./routes/NutritionPage";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useAuthBootstrap } from "./hooks/useAuth";
import { initWorkoutLogSync } from "./offline/workoutLogSync";

export function App() {
  useAuthBootstrap();
  useEffect(() => initWorkoutLogSync(), []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <WorkoutLogPage />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
