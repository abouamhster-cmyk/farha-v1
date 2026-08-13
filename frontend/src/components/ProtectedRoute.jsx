import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0C0F0E]">
        <div className="flex items-center gap-2 font-display font-bold text-lg text-white mb-6">
          <span className="w-2 h-2 rounded-full bg-henne" />
          Farha
        </div>
        <div className="w-8 h-8 border-3 border-safran/30 border-t-safran rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/connexion" replace />;

  return children;
}
