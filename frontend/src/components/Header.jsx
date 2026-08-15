import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Header() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage =
    location.pathname === "/connexion" ||
    location.pathname === "/inscription" ||
    location.pathname === "/mot-de-passe-oublie";

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md transition-colors ${
        isAuthPage
          ? "bg-[#0C0F0E]/80 border-b border-white/10 text-white"
          : "bg-cream/95 border-b border-emerald/10 text-ink"
      }`}
    >
      <nav className="max-w-[1120px] mx-auto relative flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5">
        {/* Logo */}
        <Link
          to="/"
          className={`flex items-center gap-2 font-display font-bold text-lg sm:text-xl z-10 shrink-0 ${
            isAuthPage ? "text-white" : "text-emerald"
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-henne inline-block" />
          Farha
        </Link>

        {/* Liens - cachés sur pages auth */}
        {!isAuthPage && (
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 gap-7 text-[0.92rem] font-semibold text-muted">
            <a href="/#exemples" className="hover:text-emerald transition-colors">Exemples</a>
            <a href="/#tarifs" className="hover:text-emerald transition-colors">Tarifs</a>
            <a href="/#faq" className="hover:text-emerald transition-colors">FAQ</a>
          </div>
        )}

        {/* Boutons droite */}
        <div className="flex items-center gap-1.5 sm:gap-3 z-10 shrink-0">
          {user ? (
            <>
              <Link
                to="/tableau-de-bord"
                className="text-sm font-semibold text-safran px-2 sm:px-3 py-2 whitespace-nowrap"
              >
                {profile?.full_name?.split(" ")[0] ?? "Mon espace"}
              </Link>
              <button
                onClick={() => signOut().then(() => navigate("/"))}
                className={`text-sm font-semibold px-2 sm:px-3 py-2 whitespace-nowrap transition-colors ${
                  isAuthPage
                    ? "text-white/60 hover:text-white"
                    : "text-muted hover:text-ink"
                }`}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link
                to="/connexion"
                className={`text-[0.88rem] font-semibold px-2 sm:px-4 py-2 whitespace-nowrap ${
                  isAuthPage ? "text-white/80 hover:text-white" : "text-emerald"
                }`}
              >
                Connexion
              </Link>
              <Link
                to="/inscription"
                className="bg-emerald hover:bg-emerald-light text-white text-[0.82rem] sm:text-sm font-bold rounded-xl px-3.5 sm:px-5 py-2.5 whitespace-nowrap transition-colors"
              >
                Commencer <span className="hidden sm:inline">→</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}