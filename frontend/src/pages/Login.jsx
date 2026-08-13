import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-mail ou mot de passe incorrect."
          : error.message
      );
      return;
    }
    navigate("/tableau-de-bord");
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/tableau-de-bord` },
    });
  }

  return (
    <div className="relative min-h-[calc(100vh-70px)] flex flex-col items-center justify-center px-4 sm:px-6 py-10 overflow-hidden bg-[#0C0F0E] text-white">
      {/* IMAGE DE FOND STUDIO / MUSIQUE */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1800&q=80')",
        }}
      />
      {/* OVERLAY SOMBRE AVEC FLOU D'AMBIANCE */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[3px]" />

      {/* MOTIF DISCRET (ZELLIGE) */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #E89528 0px, #E89528 1px, transparent 1px, transparent 28px), repeating-linear-gradient(-45deg, #E89528 0px, #E89528 1px, transparent 1px, transparent 28px)",
        }}
      />

      <div className="relative z-10 w-full max-w-[440px] text-center">

        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1 drop-shadow-md">Bon retour sur Farha</h1>
        <p className="text-white/70 text-xs sm:text-sm mb-6">Chansons en Darija, Raï, Chaâbi & plus</p>

        {/* CARTE TRANSLUCIDE (GLASSMORPHISM) */}
        <div className="bg-[#0C0F0E]/80 border border-white/15 rounded-3xl p-5 sm:p-8 backdrop-blur-xl shadow-2xl text-left">
          <button
            onClick={handleGoogle}
            type="button"
            className="w-full py-3 px-4 border border-white/20 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-all hover:border-safran/50"
          >
            <GoogleIcon />
            Continuer avec Google
          </button>

          <div className="flex items-center text-center text-white/40 text-xs font-semibold my-5">
            <div className="flex-1 border-b border-white/15" />
            <span className="px-3">ou avec e-mail</span>
            <div className="flex-1 border-b border-white/15" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-white/80">Adresse e-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-safran"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-white/80">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-safran"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-henne text-xs font-semibold bg-henne/10 p-2.5 rounded-lg border border-henne/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl border-none bg-henne hover:bg-henne-light text-white font-bold text-sm shadow-[0_8px_22px_rgba(184,58,40,0.35)] transition-all disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter →"}
            </button>
          </form>

          <div className="flex justify-between items-center mt-5 pt-4 border-t border-white/10 text-xs">
            <Link to="/mot-de-passe-oublie" className="text-white/60 hover:text-safran transition-colors">
              Mot de passe oublié ?
            </Link>
            <Link to="/inscription" className="text-safran font-bold hover:underline">
              Créer un compte
            </Link>
          </div>
        </div>

        <Link to="/" className="inline-block mt-6 text-white/50 hover:text-white text-xs transition-colors">
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}