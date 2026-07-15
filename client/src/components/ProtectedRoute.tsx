import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({
  children,
  role,
}: {
  children: JSX.Element;
  role?: "ADMIN" | "SPEAKER";
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
