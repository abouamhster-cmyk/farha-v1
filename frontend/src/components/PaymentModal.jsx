import { useState } from "react";
import { callFunction } from "../lib/supabaseClient.js";
import { X, CreditCard, Loader2, Sparkles, ShieldCheck } from "lucide-react";

export default function PaymentModal({ pack, onClose }) {
  const [provider, setProvider] = useState("stripe"); // "stripe" | "paypal" | "fedapay"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckout() {
    setError("");
    setLoading(true);
    try {
      const { url } = await callFunction("create-checkout", {
        packId: pack.id,
        provider,
      });

      if (!url) throw new Error("URL de paiement introuvable.");
      window.location.href = url;
    } catch (err) {
      setError(err?.message || "Erreur lors de la préparation du paiement.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-[480px] bg-white rounded-3xl p-6 sm:p-8 border border-line shadow-2xl space-y-6">
        
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-cream hover:bg-line text-muted flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* En-tête */}
        <div>
          <div className="inline-flex items-center gap-1.5 text-safran text-xs font-bold uppercase tracking-widest bg-safran/10 px-3 py-1 rounded-full border border-safran/20 mb-2">
            <Sparkles size={12} /> Confirmation Studio
          </div>
          <h2 className="font-display text-2xl font-bold">Régler votre formule</h2>
          <p className="text-muted text-xs sm:text-sm mt-1">
            Sélectionnez votre moyen de paiement sécurisé.
          </p>
        </div>

        {/* Détail du Pack sélectionné */}
        <div className="bg-cream rounded-2xl p-4 border border-line flex items-center justify-between">
          <div>
            <div className="font-bold text-sm text-ink">{pack.label}</div>
            <div className="text-xs text-muted">{pack.songs} crédits musiques HD</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold text-emerald">{pack.price}</div>
            <div className="text-[0.7rem] text-muted">{pack.perSong} / son</div>
          </div>
        </div>

        {/* Choix des providers de paiement */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Moyen de paiement
          </label>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Stripe (CB Visa/Mastercard) */}
            <button
              type="button"
              onClick={() => setProvider("stripe")}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                provider === "stripe"
                  ? "border-safran bg-safran/10 text-ink font-bold shadow-sm ring-2 ring-safran/30"
                  : "border-line bg-white hover:border-emerald/40 text-muted"
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={18} className={provider === "stripe" ? "text-safran" : "text-emerald"} />
                <div>
                  <div className="text-xs font-bold">Carte Bancaire (Stripe)</div>
                  <div className="text-[0.68rem] opacity-70">Visa, Mastercard, Carte Bleue</div>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald">Sécurisé</span>
            </button>

            {/* PayPal */}
            <button
              type="button"
              onClick={() => setProvider("paypal")}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                provider === "paypal"
                  ? "border-safran bg-safran/10 text-ink font-bold shadow-sm ring-2 ring-safran/30"
                  : "border-line bg-white hover:border-emerald/40 text-muted"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-base text-blue-600">P</span>
                <div>
                  <div className="text-xs font-bold">PayPal</div>
                  <div className="text-[0.68rem] opacity-70">Solde PayPal ou carte</div>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald">International</span>
            </button>

            {/* Fedapay (Mobile Money Afrique / Maghreb) */}
            <button
              type="button"
              onClick={() => setProvider("fedapay")}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                provider === "fedapay"
                  ? "border-safran bg-safran/10 text-ink font-bold shadow-sm ring-2 ring-safran/30"
                  : "border-line bg-white hover:border-emerald/40 text-muted"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-base text-orange-500">📱</span>
                <div>
                  <div className="text-xs font-bold">Fedapay (Mobile Money / Maghreb & Afrique)</div>
                  <div className="text-[0.68rem] opacity-70">Orange Money, Wave, MTN, Moov, cartes locales</div>
                </div>
              </div>
              <span className="text-xs font-bold text-safran">Local</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-henne/10 text-henne rounded-xl p-3 text-xs border border-henne/20">
            {error}
          </div>
        )}

        {/* Bouton de validation */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-emerald hover:bg-emerald-light text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Redirection vers le paiement…</>
          ) : (
            <>Payer {pack.price} en toute sécurité →</>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[0.7rem] text-muted/80 font-medium pt-1">
          <ShieldCheck size={14} className="text-emerald" /> Paiement chiffré SSL SSL 256-bit — Crédits ajoutés immédiatement
        </div>
      </div>
    </div>
  );
}