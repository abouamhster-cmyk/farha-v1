import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import InstallPrompt from "./InstallPrompt.jsx";
import {
  Music, LayoutDashboard, PlusCircle, CreditCard, LogOut, Menu, X, ShieldAlert
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/tableau-de-bord", label: "Tableau de bord", Icon: LayoutDashboard },
  { to: "/creer",           label: "Nouvelle chanson", Icon: PlusCircle },
  { to: "/tarifs",          label: "Crédits",          Icon: CreditCard },
];

const ADMIN_NAV = { to: "/admin", label: "Administration", Icon: ShieldAlert };

export default function DashboardLayout({ children }) {
  const { profile, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const displayName = profile?.full_name || "Mon compte";
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  function NavContent({ onNav }) {
    return (
      <>
        <div className="px-5 py-4 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg text-white">
            <span className="w-2 h-2 rounded-full bg-henne" />
            Farha
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNav}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[0.85rem] font-medium transition-colors ${
                  active ? "bg-emerald text-white" : "text-white/45 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.Icon size={17} />
                {item.label}
              </Link>
            );
          })}
          {profile?.is_admin && (
            <>
              <div className="border-t border-white/10 my-3" />
              <Link
                to={ADMIN_NAV.to}
                onClick={onNav}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[0.85rem] font-medium transition-colors ${
                  location.pathname === ADMIN_NAV.to ? "bg-henne text-white" : "text-henne-light hover:text-white hover:bg-white/5"
                }`}
              >
                <ADMIN_NAV.Icon size={17} />
                {ADMIN_NAV.label}
              </Link>
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-emerald text-safran flex items-center justify-center text-[0.7rem] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-[0.8rem] font-semibold text-white truncate">{displayName}</div>
              <div className="text-[0.7rem] text-white/35">{profile?.credits ?? 0} crédit{(profile?.credits ?? 0) !== 1 ? "s" : ""}</div>
            </div>
          </div>
          <button
            onClick={() => signOut().then(() => navigate("/"))}
            className="flex items-center gap-2 text-white/35 hover:text-white/60 text-[0.75rem] font-medium transition-colors"
          >
            <LogOut size={13} /> Déconnexion
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-cream">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-[230px] bg-[#0C0F0E] text-white flex-shrink-0 fixed inset-y-0 left-0 z-40">
        <NavContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[260px] h-full bg-[#0C0F0E] text-white flex flex-col shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X size={20} />
            </button>
            <NavContent onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 flex flex-col lg:ml-[230px] min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 bg-[#0C0F0E] px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="text-white/60 hover:text-white">
            <Menu size={22} />
          </button>
          <Link to="/" className="font-display font-bold text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-henne" /> Farha
          </Link>
          <div className="w-8 h-8 rounded-full bg-emerald text-safran flex items-center justify-center text-[0.65rem] font-bold">
            {initials}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>

      <InstallPrompt />
    </div>
  );
}
