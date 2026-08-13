import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Chargement…
      </div>
    );
  }

  if (!user) return <Navigate to="/connexion" replace />;
  if (!profile?.is_admin) return <Navigate to="/tableau-de-bord" replace />;

  return children;
}
