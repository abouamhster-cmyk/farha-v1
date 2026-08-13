import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import { Loader2 } from "lucide-react";
import Header from "./components/Header.jsx";
import DashboardLayout from "./components/DashboardLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const Landing = lazy(() => import("./pages/Landing.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Signup = lazy(() => import("./pages/Signup.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const CreateSong = lazy(() => import("./pages/CreateSong.jsx"));
const SongDetail = lazy(() => import("./pages/SongDetail.jsx"));
const PricingPage = lazy(() => import("./pages/PricingPage.jsx"));
const Credits = lazy(() => import("./pages/Credits.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));
const Legal = lazy(() => import("./pages/Legal.jsx"));
const PublicSong = lazy(() => import("./pages/PublicSong.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 size={28} className="text-safran animate-spin" />
    </div>
  );
}

function PublicLayout({ children }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/tableau-de-bord" replace />;
  return children;
}

function AppLayout({ children }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<PublicRoute><PublicLayout><Landing /></PublicLayout></PublicRoute>} />
        <Route path="/connexion" element={<PublicRoute><PublicLayout><Login /></PublicLayout></PublicRoute>} />
        <Route path="/inscription" element={<PublicRoute><PublicLayout><Signup /></PublicLayout></PublicRoute>} />
        <Route path="/mot-de-passe-oublie" element={<PublicRoute><PublicLayout><ResetPassword /></PublicLayout></PublicRoute>} />

        <Route path="/ecouter/:songId" element={<PublicSong />} />
        <Route path="/mentions-legales" element={<Legal />} />

        <Route path="/tableau-de-bord" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/creer" element={<AppLayout><CreateSong /></AppLayout>} />
        <Route path="/chanson/:songId" element={<AppLayout><SongDetail /></AppLayout>} />
        <Route path="/tarifs" element={<AppLayout><PricingPage /></AppLayout>} />
        <Route path="/credits" element={<AppLayout><Credits /></AppLayout>} />
        <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
