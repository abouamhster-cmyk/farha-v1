import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import Header from "./components/Header.jsx";
import DashboardLayout from "./components/DashboardLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CreateSong from "./pages/CreateSong.jsx";
import SongDetail from "./pages/SongDetail.jsx";
import PricingPage from "./pages/PricingPage.jsx";
import PublicSong from "./pages/PublicSong.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminRoute from "./components/AdminRoute.jsx";

// Layout public (avec le header classique)
function PublicLayout({ children }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}

// Redirige automatiquement vers le Dashboard si l'utilisateur est DÉJÀ CONNECTÉ
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/tableau-de-bord" replace />;
  return children;
}

// Layout protégé (avec la sidebar du tableau de bord)
function AppLayout({ children }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Pages publiques (accessibles uniquement si DÉCONNECTÉ) */}
      <Route path="/" element={<PublicRoute><PublicLayout><Landing /></PublicLayout></PublicRoute>} />
      <Route path="/connexion" element={<PublicRoute><PublicLayout><Login /></PublicLayout></PublicRoute>} />
      <Route path="/inscription" element={<PublicRoute><PublicLayout><Signup /></PublicLayout></PublicRoute>} />
      <Route path="/mot-de-passe-oublie" element={<PublicRoute><PublicLayout><ResetPassword /></PublicLayout></PublicRoute>} />

      {/* Page de partage publique : accessible que le visiteur soit connecté
          ou non, donc ni PublicRoute (qui redirige les connectés) ni
          ProtectedRoute. Le header est géré à l'intérieur de PublicSong. */}
      <Route path="/ecouter/:songId" element={<PublicSong />} />

      {/* Pages connectées (sidebar du Dashboard) */}
      <Route path="/tableau-de-bord" element={<AppLayout><Dashboard /></AppLayout>} />
      <Route path="/creer" element={<AppLayout><CreateSong /></AppLayout>} />
      <Route path="/chanson/:songId" element={<AppLayout><SongDetail /></AppLayout>} />
      <Route path="/tarifs" element={<AppLayout><PricingPage /></AppLayout>} />
      <Route path="/admin" element={<AdminRoute><DashboardLayout><AdminDashboard /></DashboardLayout></AdminRoute>} />

      {/* Redirection par défaut pour les URL introuvables */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}