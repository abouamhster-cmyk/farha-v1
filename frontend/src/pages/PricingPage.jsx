import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import PaymentModal from "../components/PaymentModal.jsx";
import {
  CheckCircle2, Sparkles, Shield, ArrowRight, Music,
  Zap, Clock, Crown, MessageCircle, Gift, Image as ImageIcon, Download, Loader2, Globe, Film
} from "lucide-react";

const PLAN_CONTENT = {
  pack4: {
    name: "Découverte",
    popular: false,
    description: "Pour tester vos premiers sons",
    modelTag: "Modèle Audio Standard HD",
    features: [
      { text: "4 compositions audio HD (MP3/WAV)", Icon: Music },
      { text: "Pochette d'album dédiée", Icon: ImageIcon },
      { text: "Paroles gratuites, modifiables & régénérables", Icon: CheckCircle2 },
      { text: "Crédits sans expiration", Icon: Clock },
    ],
  },
  pack10: {
    name: "Créateur TikTok & Reels",
    popular: true,
    description: "Le choix le plus populaire sur les réseaux",
    modelTag: "Modèle Audio Haute-Fidélité (-20% de réduction)",
    features: [
      { text: "🔥 -20% de réduction (0,60 € / chanson)", Icon: Sparkles },
      { text: "Tout le plan Découverte inclus", Icon: CheckCircle2 },
      { text: "10 compositions audio HD", Icon: Music },
      { text: "Génération musicale prioritaire", Icon: Zap },
      { text: "Clips Vidéos 9:16 (Prochainement)", Icon: Film },
    ],
  },
  pack20: {
    name: "Pro & Business",
    popular: false,
    description: "Pour les marques, pubs et grands événements",
    modelTag: "Modèle Studio Pro (Google Lyria 3 Pro)",
    features: [
      { text: "⚡ -33% de réduction (0,50 € / chanson)", Icon: Sparkles },
      { text: "Tout le plan Créateur inclus", Icon: CheckCircle2 },
      { text: "20 compositions audio HD", Icon: Music },
      { text: "Auteur-parolier avancé (Gemini 3.5 Pro)", Icon: Sparkles },
      { text: "Droits d'usage commercial & pubs inclus", Icon: Shield },
      { text: "Support prioritaire dédié sous 12h", Icon: MessageCircle },
    ],
  },
  pack40: {
    name: "Studio VIP",
    popular: false,
    description: "Pour les créateurs fréquents et agences",
    modelTag: "Modèle Master Studio Ultra-HD (-35% de réduction)",
    features: [
      { text: "👑 -35% de réduction (0,49 € / chanson)", Icon: Crown },
      { text: "Tout le plan Pro & Business inclus", Icon: CheckCircle2 },
      { text: "40 compositions audio HD", Icon: Music },
      { text: "Génération instantanée zéro attente", Icon: Zap },
      { text: "Support privé WhatsApp 7j/7", Icon: MessageCircle },
      { text: "Badge Créateur VIP sur le profil", Icon: Crown },
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
    <div className="px-5 sm:px-8 lg:px-12 py-6 lg:py-10 max-w-7xl mx-auto">

      {/* Header Page Tarifs */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-safran text-xs font-bold uppercase tracking-widest mb-2">
          <Sparkles size={14} /> Formules du Studio
        </div>
        <h1 className="font-display text-2xl sm:text-4xl font-bold mb-2">Choisissez votre formule</h1>
        <p className="text-muted text-sm sm:text-base max-w-[640px]">
          Chaque crédit débloque 1 musique complète en HD avec sa pochette d'album dédicacée.
        </p>
        {credits > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald/10 text-emerald px-4 py-2 rounded-xl text-sm font-semibold">
            <Sparkles size={14} /> {credits} crédit{credits > 1 ? "s" : ""} disponible{credits > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Promo Cadeau Première Musique */}
      <div className="bg-white border border-safran/30 rounded-3xl p-6 mb-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-safran/15 flex items-center justify-center flex-shrink-0">
          <Gift size={24} className="text-safran" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg mb-0.5">Paroles et extrait audio toujours gratuits</h3>
          <p className="text-xs sm:text-sm text-muted">Créez et écoutez gratuitement vos paroles et votre extrait audio (15s à 30s) sans engagement.</p>
        </div>
      </div>

      {/* Cartes de Tarifs Alignées */}
      {!plans ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="text-safran animate-spin" /></div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 items-stretch">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative rounded-3xl flex flex-col justify-between overflow-hidden transition-all hover:shadow-lg ${
              plan.popular
                ? "bg-[#0C0F0E] text-white border-2 border-safran shadow-xl"
                : "bg-white border border-line"
            }`}
          >
            {plan.popular && (
              <div className="bg-safran text-ink text-[0.68rem] font-bold uppercase tracking-wider text-center py-1.5">
                ★ Le plus populaire
              </div>
            )}

            <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
              <div>
                <div className={`text-xs font-bold uppercase tracking-widest mb-1.5 ${plan.popular ? "text-safran" : "text-emerald"}`}>
                  {plan.name}
                </div>
                <p className={`text-xs mb-3 ${plan.popular ? "text-white/60" : "text-muted"}`}>
                  {plan.description}
                </p>

                {/* BADGE DE MODÈLE DE NIVEAU */}
                {plan.modelTag && (
                  <div className="mb-4">
                    <span className={`inline-block text-[0.68rem] font-bold px-2.5 py-1 rounded-md border ${
                      plan.popular ? "bg-safran/15 text-safran border-safran/30" : "bg-emerald/10 text-emerald border-emerald/20"
                    }`}>
                      ⚡ {plan.modelTag}
                    </span>
                  </div>
                )}

                <div className="mb-1">
                  <span className={`font-display text-4xl font-bold ${plan.popular ? "text-white" : "text-ink"}`}>
                    {plan.price}
                  </span>
                </div>
                <div className={`text-xs mb-6 ${plan.popular ? "text-white/50" : "text-muted"}`}>
                  {plan.songs} musiques · {plan.perSong} / son
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f.text} className={`flex items-start gap-2.5 text-xs sm:text-sm ${plan.popular ? "text-white/85" : "text-muted"}`}>
                      <f.Icon size={16} className={`flex-shrink-0 mt-0.5 ${plan.popular ? "text-safran" : "text-emerald"}`} />
                      {f.text}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setSelectedPack(plan)}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-auto cursor-pointer ${
                  plan.popular
                    ? "bg-safran hover:bg-safran-bright text-ink"
                    : "bg-emerald hover:bg-emerald-light text-white"
                }`}
              >
                Choisir ce plan <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Avantages Inclus dans tous les plans */}
      <div className="bg-white border border-line rounded-3xl p-6 sm:p-10 mb-10 shadow-sm">
        <h3 className="font-display text-xl font-bold mb-6 text-center">Inclus dans toutes vos créations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { Icon: ImageIcon, title: "Pochette d'album dédicacée", desc: "Illustration artistique unique créée selon le thème et l'histoire de votre chanson." },
            { Icon: Globe, title: "Tous les dialectes arabes", desc: "Marocain, Algérien, Tunisien, Libyen, Mauritanien, Égyptien, Levantin, Khaleeji ou Fusha." },
            { Icon: Download, title: "Téléchargement HD instantané", desc: "Fichier audio haute définition téléchargeable immédiatement dès le déblocage." },
            { Icon: CheckCircle2, title: "Paroles & Retouches Gratuites", desc: "Rédigez et modifiez votre texte autant de fois que nécessaire sans payer." },
            { Icon: Shield, title: "Sans Engagement & Sans Abonnement", desc: "Achetez uniquement ce dont vous avez besoin. Vos crédits n'expirent jamais." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-cream flex items-center justify-center flex-shrink-0 text-emerald">
                <item.Icon size={20} />
              </div>
              <div>
                <h4 className="font-bold text-sm mb-1">{item.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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