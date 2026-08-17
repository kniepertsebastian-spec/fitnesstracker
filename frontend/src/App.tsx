import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage";
import { RegisterPage } from "./routes/RegisterPage";
import { WorkoutLogPage } from "./routes/WorkoutLogPage";
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
