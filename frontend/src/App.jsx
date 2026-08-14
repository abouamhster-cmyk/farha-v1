import { lazy, Suspense, useLayoutEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import Header from "./components/Header.jsx";
import DashboardLayout from "./components/DashboardLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import TopProgressBar from "./components/TopProgressBar.jsx";
import PageTransition from "./components/PageTransition.jsx";
import { RouteFallback } from "./components/Skeleton.jsx";
import { start } from "./lib/progress.js";

// Code-splitting : chaque page devient un chunk charge a la demande.
// Le shell (header, sidebar, routes) reste instantane ; seul le corps
// de la page voyage sur le reseau -> premier rendu bien plus rapide.
const Landing = lazy(() => import("./pages/Landing.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const CreateSong = lazy(() => import("./pages/CreateSong.jsx"));
const SongDetail = lazy(() => import("./pages/SongDetail.jsx"));
const PricingPage = lazy(() => import("./pages/PricingPage.jsx"));
const PublicSong = lazy(() => import("./pages/PublicSong.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));

// Demarre la barre de progression a chaque changement d'URL.
// (PageTransition, cote contenu, la termine quand le chunk est pret.)
function RouteProgress() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    start();
  }, [pathname]);
  return null;
}

// Layout public (avec le header classique)
function PublicLayout({ children }) {
  return (
    <>
      <Header />
      <Suspense fallback={<RouteFallback />}>
        <PageTransition>{children}</PageTransition>
      </Suspense>
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
      <DashboardLayout>
        <Suspense fallback={<RouteFallback />}>
          <PageTransition>{children}</PageTransition>
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <>
      <TopProgressBar />
      <RouteProgress />
      <Routes>
        {/* Pages publiques (accessibles uniquement si DÉCONNECTÉ) */}
        <Route path="/" element={<PublicRoute><PublicLayout><Landing /></PublicLayout></PublicRoute>} />
        <Route path="/connexion" element={<PublicRoute><PublicLayout><Login /></PublicLayout></PublicRoute>} />
        <Route path="/inscription" element={<PublicRoute><PublicLayout><Signup /></PublicLayout></PublicRoute>} />
        <Route path="/mot-de-passe-oublie" element={<PublicRoute><PublicLayout><ResetPassword /></PublicLayout></PublicRoute>} />

        {/* Page de partage publique : accessible que le visiteur soit connecté
            ou non, donc ni PublicRoute (qui redirige les connectés) ni
            ProtectedRoute. Le header est géré à l'intérieur de PublicSong. */}
        <Route
          path="/ecouter/:songId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <PageTransition><PublicSong /></PageTransition>
            </Suspense>
          }
        />

        {/* Pages connectées (sidebar du Dashboard) */}
        <Route path="/tableau-de-bord" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/creer" element={<AppLayout><CreateSong /></AppLayout>} />
        <Route path="/chanson/:songId" element={<AppLayout><SongDetail /></AppLayout>} />
        <Route path="/tarifs" element={<AppLayout><PricingPage /></AppLayout>} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <DashboardLayout>
                <Suspense fallback={<RouteFallback />}>
                  <PageTransition><AdminDashboard /></PageTransition>
                </Suspense>
              </DashboardLayout>
            </AdminRoute>
          }
        />

        {/* Redirection par défaut pour les URL introuvables */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
