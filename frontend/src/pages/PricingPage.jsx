import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import PaymentModal from "../components/PaymentModal.jsx";
import {
  Sparkles, ArrowRight, Loader2, Check
} from "lucide-react";

const PLAN_CONTENT = {
  pack4: {
    name: "Découverte",
    popular: false,
    desc: "Pour tester vos premiers sons",
    modelTag: "Lyria 3 Standard",
    features: [
      "4 musiques complètes HD (1:59 min)",
      "Pochette d'album dédiée",
      "Paroles gratuites & modifiables",
      "Crédits sans expiration",
    ],
  },
  pack10: {
    name: "Créateur TikTok & Reels",
    popular: true,
    desc: "Le choix N°1 pour les réseaux",
    modelTag: "Lyria 3 Haute-Fidélité",
    discountBadge: "-20%",
    features: [
      "🔥 -20% (0,60 € la chanson)",
      "Tout le plan Découverte inclus",
      "10 musiques HD (2:30 min)",
      "Génération prioritaire rapide",
      "Clips Vidéos 9:16 (Bientôt)",
    ],
  },
  pack20: {
    name: "Pro & Business",
    popular: false,
    desc: "Pour les marques et publicités",
    modelTag: "Google Lyria 3 Pro (3 min)",
    discountBadge: "-33%",
    features: [
      "⚡ -33% (0,50 € la chanson)",
      "Tout le plan Créateur inclus",
      "20 musiques Master (3 min)",
      "Auteur-parolier avancé (Gemini)",
      "Droits d'usage commercial & pubs",
      "Support prioritaire sous 12h",
    ],
  },
  pack40: {
    name: "Studio VIP",
    popular: false,
    desc: "Pour agences et créateurs fréquents",
    modelTag: "Master Studio Ultra-HD",
    discountBadge: "-35%",
    features: [
      "👑 -35% (0,49 € la chanson)",
      "Tout le plan Pro inclus",
      "40 musiques Master (3 min)",
      "Composition instantanée zéro attente",
      "Support privé WhatsApp 7j/7",
      "Badge Créateur VIP",
    ],
  },
};

const PLAN_ORDER = ["pack4", "pack10", "pack20", "pack40"];

function formatEuros(cents) {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function PricingPage() {
  const { profile } = useAuth();
  const [selectedPack, setSelectedPack] = useState(null);
  const [plans, setPlans] = useState(null);
  const credits = profile?.credits ?? 0;

  useEffect(() => {
    supabase
      .from("pricing_packs")
      .select("id, label, song_count, price_cents")
      .eq("active", true)
      .then(({ data }) => {
        if (!data) return;
        const merged = data
          .map((pack) => ({
            id: pack.id,
            songs: pack.song_count,
            price: formatEuros(pack.price_cents),
            perSong: formatEuros(Math.round(pack.price_cents / pack.song_count)),
            ...PLAN_CONTENT[pack.id],
          }))
          .filter((p) => p.name)
          .sort((a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id));
        setPlans(merged);
      });
  }, []);

  return (
    <div className="px-4 sm:px-8 lg:px-10 py-6 lg:py-8 max-w-7xl mx-auto">

      {/* Header Page Tarifs Compact */}
      <div className="mb-6 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 text-safran text-xs font-bold uppercase tracking-widest bg-safran/10 px-3 py-1 rounded-full border border-safran/20 mb-2">
          <Sparkles size={13} /> Formules du Studio
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1">Choisissez votre formule</h1>
        <p className="text-muted text-xs sm:text-sm max-w-[620px]">
          Chaque crédit débloque 1 musique complète en HD avec sa pochette d'album dédicacée.
        </p>
        {credits > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-emerald/10 text-emerald px-3.5 py-1.5 rounded-xl text-xs font-bold border border-emerald/20">
            <Sparkles size={13} /> {credits} crédit{credits > 1 ? "s" : ""} disponible{credits > 1 ? "s" : ""} dans votre solde
          </div>
        )}
      </div>

      {/* Cartes de Tarifs Modernes, Compactes & Aérées */}
      {!plans ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="text-safran animate-spin" /></div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 items-stretch mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-2xl flex flex-col justify-between overflow-hidden transition-all duration-200 hover:-translate-y-1 ${
              plan.popular
                ? "bg-[#0C0F0E] text-white border-2 border-safran shadow-xl ring-1 ring-safran/20"
                : "bg-white border border-line/80 hover:border-safran/50 shadow-xs hover:shadow-md"
            }`}
          >
            {/* Badge Recommandé */}
            {plan.popular && (
              <div className="bg-safran text-ink text-[0.65rem] font-extrabold uppercase tracking-wider text-center py-1.5 shadow-xs">
                ★ LE PLUS POPULAIRE
              </div>
            )}

            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
              <div>
                {/* Nom du plan + Badge réduction */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-xs font-extrabold uppercase tracking-wider ${plan.popular ? "text-safran" : "text-emerald"}`}>
                    {plan.name}
                  </span>
                  {plan.discountBadge && (
                    <span className={`text-[0.62rem] font-extrabold px-2 py-0.5 rounded-full ${
                      plan.popular ? "bg-henne text-white" : "bg-safran/15 text-safran border border-safran/30"
                    }`}>
                      {plan.discountBadge}
                    </span>
                  )}
                </div>

                <p className={`text-[0.72rem] mb-2.5 leading-snug ${plan.popular ? "text-white/60" : "text-muted"}`}>
                  {plan.desc}
                </p>

                {/* Badge du Modèle */}
                <div className="mb-3">
                  <span className={`inline-flex items-center gap-1 text-[0.65rem] font-bold px-2.5 py-0.5 rounded-md border ${
                    plan.popular ? "bg-white/10 text-safran-bright border-white/15" : "bg-cream text-emerald border-line"
                  }`}>
                    ⚡ {plan.modelTag}
                  </span>
                </div>

                {/* Prix */}
                <div className="mb-0.5 flex items-baseline gap-1">
                  <span className={`font-display text-3xl font-extrabold leading-none ${plan.popular ? "text-white" : "text-ink"}`}>
                    {plan.price}
                  </span>
                </div>

                <div className={`text-[0.72rem] font-medium mb-4 ${plan.popular ? "text-white/40" : "text-muted"}`}>
                  {plan.songs} musiques · <span className="font-bold">{plan.perSong}</span> / son
                </div>

                {/* Puces d'avantages compactes */}
                <ul className="space-y-2 mb-5">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-[0.75rem] leading-snug ${plan.popular ? "text-white/85" : "text-muted"}`}>
                      <Check size={14} className={`flex-shrink-0 mt-0.5 ${plan.popular ? "text-safran font-bold" : "text-emerald font-bold"}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bouton d'action */}
              <button
                onClick={() => setSelectedPack(plan)}
                className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 mt-auto cursor-pointer shadow-xs ${
                  plan.popular
                    ? "bg-safran hover:bg-safran-bright text-ink"
                    : "bg-emerald hover:bg-emerald-light text-white"
                }`}
              >
                Choisir ce plan <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Modal Paiement */}
      {selectedPack && (
        <PaymentModal
          pack={{
            id: selectedPack.id,
            label: selectedPack.name,
            songs: selectedPack.songs,
            price: selectedPack.price,
            perSong: selectedPack.perSong,
          }}
          onClose={() => setSelectedPack(null)}
        />
      )}
    </div>
  );
}