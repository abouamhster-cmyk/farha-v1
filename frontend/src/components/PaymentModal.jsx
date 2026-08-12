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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* CARTE MODAL RESPONSIVE COMPACTE (MAX 90VH + SCROLL INTERNE) */}
      <div className="relative w-full max-w-[440px] bg-white rounded-3xl p-5 sm:p-7 border border-line shadow-2xl my-auto max-h-[90vh] overflow-y-auto space-y-4 sm:space-y-5">
        
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream hover:bg-line text-muted flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        {/* En-tête */}
        <div className="pr-6">
          <div className="inline-flex items-center gap-1 text-safran text-[0.7rem] font-bold uppercase tracking-widest bg-safran/10 px-2.5 py-0.5 rounded-full border border-safran/20 mb-1.5">
            <Sparkles size={11} /> Confirmation Studio
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold leading-tight">Régler votre formule</h2>
          <p className="text-muted text-xs mt-1">
            Sélectionnez votre moyen de paiement sécurisé.
          </p>
        </div>

        {/* Récapitulatif du Pack */}
        <div className="bg-cream rounded-2xl p-3.5 border border-line flex items-center justify-between">
          <div>
            <div className="font-bold text-xs sm:text-sm text-ink">{pack.label}</div>
            <div className="text-[0.7rem] text-muted">{pack.songs} crédits musiques HD</div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg sm:text-xl font-bold text-emerald">{pack.price}</div>
            <div className="text-[0.65rem] text-muted">{pack.perSong} / son</div>
          </div>
        </div>

        {/* Choix des Moyens de Paiement */}
        <div className="space-y-2">
          <label className="block text-[0.7rem] font-bold uppercase tracking-wider text-muted">
            Moyen de paiement
          </label>

          <div className="grid grid-cols-1 gap-2">
            {/* Stripe */}
            <button
              type="button"
              onClick={() => setProvider("stripe")}
              className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                provider === "stripe"
                  ? "border-safran bg-safran/10 text-ink font-bold shadow-xs ring-2 ring-safran/30"
                  : "border-line bg-white hover:border-emerald/40 text-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard size={16} className={provider === "stripe" ? "text-safran" : "text-emerald"} />
                <div>
                  <div className="text-xs font-bold leading-tight">Carte Bancaire (Stripe)</div>
                  <div className="text-[0.65rem] opacity-75">Visa, Mastercard, Carte Bleue</div>
                </div>
              </div>
              <span className="text-[0.65rem] font-bold text-emerald bg-emerald/10 px-2 py-0.5 rounded-md">Sécurisé</span>
            </button>

            {/* PayPal */}
            <button
              type="button"
              onClick={() => setProvider("paypal")}
              className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                provider === "paypal"
                  ? "border-safran bg-safran/10 text-ink font-bold shadow-xs ring-2 ring-safran/30"
                  : "border-line bg-white hover:border-emerald/40 text-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm text-blue-600">P</span>
                <div>
                  <div className="text-xs font-bold leading-tight">PayPal</div>
                  <div className="text-[0.65rem] opacity-75">Solde PayPal ou carte</div>
                </div>
              </div>
              <span className="text-[0.65rem] font-bold text-emerald bg-emerald/10 px-2 py-0.5 rounded-md">International</span>
            </button>

            {/* Fedapay */}
            <button
              type="button"
              onClick={() => setProvider("fedapay")}
              className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                provider === "fedapay"
                  ? "border-safran bg-safran/10 text-ink font-bold shadow-xs ring-2 ring-safran/30"
                  : "border-line bg-white hover:border-emerald/40 text-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-sm text-orange-500">📱</span>
                <div>
                  <div className="text-xs font-bold leading-tight">Fedapay (Mobile Money / Afrique)</div>
                  <div className="text-[0.65rem] opacity-75">Orange Money, Wave, MTN, Moov, cartes locales</div>
                </div>
              </div>
              <span className="text-[0.65rem] font-bold text-safran bg-safran/10 px-2 py-0.5 rounded-md">Local</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-henne/10 text-henne rounded-xl p-2.5 text-xs border border-henne/20">
            {error}
          </div>
        )}

        {/* Bouton de Validation */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-emerald hover:bg-emerald-light text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Redirection vers le paiement…</>
          ) : (
            <>Payer {pack.price} en toute sécurité →</>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[0.68rem] text-muted font-medium pt-0.5">
          <ShieldCheck size={13} className="text-emerald" /> Paiement chiffré SSL 256-bit — Crédits ajoutés immédiatement
        </div>
      </div>
    </div>
  );
}