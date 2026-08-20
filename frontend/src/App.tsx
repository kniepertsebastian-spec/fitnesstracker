import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage";
import { RegisterPage } from "./routes/RegisterPage";
import { WorkoutLogPage } from "./routes/WorkoutLogPage";
import { ExerciseLibraryPage } from "./routes/ExerciseLibraryPage";
import { ExerciseDetailPage } from "./routes/ExerciseDetailPage";
import { TrainingPlanPage } from "./routes/TrainingPlanPage";
import { GoalsPage } from "./routes/GoalsPage";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useAuthBootstrap } from "./hooks/useAuth";

export function App() {
  useAuthBootstrap();

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
          path="/goals"
          element={
            <ProtectedRoute>
              <GoalsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
