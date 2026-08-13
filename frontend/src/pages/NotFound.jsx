import { Link } from "react-router-dom";
import { Home, Music } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald to-[#0C0F0E] flex items-center justify-center mx-auto mb-6 shadow-xl">
          <Music size={36} className="text-safran" />
        </div>

        <h1 className="font-display text-6xl font-bold text-emerald mb-2">404</h1>
        <p className="text-lg font-semibold text-ink mb-2">Page introuvable</p>
        <p className="text-sm text-muted mb-8">
          Cette page n'existe pas ou a été déplacée.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-emerald hover:bg-emerald-light text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            <Home size={16} /> Retour à l'accueil
          </Link>
          <Link
            to="/creer"
            className="inline-flex items-center gap-2 border border-emerald text-emerald hover:bg-emerald hover:text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            <Music size={16} /> Créer une chanson
          </Link>
        </div>
      </div>
    </div>
  );
}
