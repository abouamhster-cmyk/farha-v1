import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";

export default function ResetPassword() {
  const [mode, setMode] = useState("request"); // "request" | "update"
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase redirige ici avec un access_token de type "recovery" dans
    // le hash de l'URL après clic sur le lien reçu par e-mail.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleRequest(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/mot-de-passe-oublie`,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setMessage("Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé.");
  }

  async function handleUpdate(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return setError(error.message);
    navigate("/tableau-de-bord");
  }

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center px-5 py-16 bg-cream">
      <div className="w-full max-w-[440px]">
        <h1 className="font-display text-[1.8rem] font-bold mb-2 text-center">
          {mode === "request" ? "Mot de passe oublié" : "Choisir un nouveau mot de passe"}
        </h1>
        <p className="text-muted text-center mb-8">
          {mode === "request"
            ? "Recevez un lien pour réinitialiser votre mot de passe."
            : "Dernière étape avant de retrouver votre espace."}
        </p>

        <div className="bg-white border border-black/[0.08] rounded-[20px] p-9 shadow-[0_15px_35px_rgba(0,0,0,0.04)]">
          {mode === "request" ? (
            <form onSubmit={handleRequest} className="space-y-[18px]">
              <div>
                <label className="block text-[0.86rem] font-semibold mb-2">Adresse e-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="votre@email.com"
                />
              </div>
              {message && <p className="text-emerald text-sm">{message}</p>}
              {error && <p className="text-henne text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? "Envoi…" : "Envoyer le lien"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-[18px]">
              <div>
                <label className="block text-[0.86rem] font-semibold mb-2">Nouveau mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field"
                  placeholder="8 caractères minimum"
                />
              </div>
              {error && <p className="text-henne text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
                {loading ? "Mise à jour…" : "Valider le nouveau mot de passe"}
              </button>
            </form>
          )}
        </div>

        <Link to="/connexion" className="block text-center mt-6 text-muted text-sm">
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
