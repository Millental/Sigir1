import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { CyclesPage } from "./pages/CyclesPage";
import { SlideFormPage } from "./pages/SlideFormPage";
import { ReviewPage } from "./pages/ReviewPage";
import { AssemblePage } from "./pages/AssemblePage";
import { PrintPage } from "./pages/PrintPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute role="ADMIN">
            <TemplatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cycles"
        element={
          <ProtectedRoute role="ADMIN">
            <CyclesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/slides"
        element={
          <ProtectedRoute role="SPEAKER">
            <SlideFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/review"
        element={
          <ProtectedRoute role="ADMIN">
            <ReviewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/presentation"
        element={
          <ProtectedRoute>
            <AssemblePage />
          </ProtectedRoute>
        }
      />
      <Route path="/print/:weeklyCycleId" element={<PrintPage />} />
    </Routes>
  );
}
