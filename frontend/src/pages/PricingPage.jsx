import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { PLAN_CONTENT, PLAN_ORDER, formatEuros } from "../lib/planContent.js";
import PaymentModal from "../components/PaymentModal.jsx";
import {
  Sparkles, ArrowRight, Loader2, Check, Clock, Headphones, Shield, MessageCircle
} from "lucide-react";

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

      {/* Header */}
      <div className="mb-6 text-center sm:text-left animate-slideUp">
        <div className="inline-flex items-center gap-1.5 text-safran text-xs font-bold uppercase tracking-widest bg-safran/10 px-3 py-1 rounded-full border border-safran/20 mb-2">
          <Sparkles size={13} /> Formules du Studio
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1">Choisissez votre formule</h1>
        <p className="text-muted text-xs sm:text-sm max-w-[620px]">
          Chaque crédit débloque 1 musique complète avec sa pochette d'album. Sans abonnement, sans engagement.
        </p>
        {credits > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 bg-emerald/10 text-emerald px-3.5 py-1.5 rounded-xl text-xs font-bold border border-emerald/20 animate-popIn">
            <Sparkles size={13} /> {credits} crédit{credits > 1 ? "s" : ""} disponible{credits > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Cartes de tarifs */}
      {!plans ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="text-safran animate-spin" /></div>
      ) : (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 items-stretch mb-8">
          {plans.map((plan, idx) => {
            const PlanIcon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 animate-slideUp ${
                  plan.popular
                    ? "bg-[#0C0F0E] text-white border-2 border-safran shadow-xl ring-1 ring-safran/20"
                    : "bg-white border border-line/80 hover:border-safran/50 shadow-xs hover:shadow-md"
                }`}
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}
              >
                {plan.popular && (
                  <div className="bg-safran text-ink text-[0.65rem] font-extrabold uppercase tracking-wider text-center py-1.5 shadow-xs">
                    ★ LE PLUS POPULAIRE
                  </div>
                )}

                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Nom du plan + icone + badge */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider ${plan.popular ? "text-safran" : "text-emerald"}`}>
                        {PlanIcon && <PlanIcon size={14} />}
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

                    <p className={`text-[0.72rem] mb-3 leading-snug ${plan.popular ? "text-white/60" : "text-muted"}`}>
                      {plan.desc}
                    </p>

                    {/* Prix */}
                    <div className="mb-0.5 flex items-baseline gap-1">
                      <span className={`font-display text-3xl font-extrabold leading-none ${plan.popular ? "text-white" : "text-ink"}`}>
                        {plan.price}
                      </span>
                    </div>

                    <div className={`text-[0.72rem] font-medium mb-4 ${plan.popular ? "text-white/40" : "text-muted"}`}>
                      {plan.songs} musiques · <span className="font-bold">{plan.perSong}</span> / son
                    </div>

                    {/* Bénéfices clés (durée, support, commercial) */}
                    <div className={`rounded-xl p-3 mb-4 space-y-2 ${plan.popular ? "bg-white/5 border border-white/10" : "bg-cream/80 border border-line/60"}`}>
                      <div className="flex items-center gap-2 text-[0.72rem]">
                        <Clock size={13} className={plan.popular ? "text-safran" : "text-emerald"} />
                        <span className={plan.popular ? "text-white/80" : "text-muted"}>Durée max : <strong className={plan.popular ? "text-white" : "text-ink"}>{plan.benefits.duration}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-[0.72rem]">
                        <MessageCircle size={13} className={plan.popular ? "text-safran" : "text-emerald"} />
                        <span className={plan.popular ? "text-white/80" : "text-muted"}>Support : <strong className={plan.popular ? "text-white" : "text-ink"}>{plan.benefits.support}</strong></span>
                      </div>
                      {plan.benefits.commercial && (
                        <div className="flex items-center gap-2 text-[0.72rem]">
                          <Shield size={13} className={plan.popular ? "text-safran" : "text-emerald"} />
                          <span className={plan.popular ? "text-white/80" : "text-muted"}><strong className={plan.popular ? "text-safran" : "text-emerald"}>Usage commercial inclus</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-5">
                      {plan.features.map((f) => (
                        <li key={f} className={`flex items-start gap-2 text-[0.75rem] leading-snug ${plan.popular ? "text-white/85" : "text-muted"}`}>
                          <Check size={14} className={`flex-shrink-0 mt-0.5 ${plan.popular ? "text-safran font-bold" : "text-emerald font-bold"}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bouton */}
                  <button
                    onClick={() => setSelectedPack(plan)}
                    className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 mt-auto cursor-pointer shadow-xs active:scale-[0.97] ${
                      plan.popular
                        ? "bg-safran hover:bg-safran-bright text-ink"
                        : "bg-emerald hover:bg-emerald-light text-white"
                    }`}
                  >
                    Choisir ce plan <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tableau comparatif compact */}
        <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm animate-slideUp" style={{ animationDelay: "300ms", animationFillMode: "both" }}>
          <div className="p-4 sm:p-5 border-b border-line bg-cream/50">
            <h2 className="font-display text-lg font-bold">Comparatif des formules</h2>
            <p className="text-muted text-xs mt-0.5">Tous les plans incluent : paroles gratuites, pochette IA, crédits sans expiration</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left p-3 sm:p-4 text-muted font-semibold w-[140px]">Bénéfice</th>
                  {plans.map((p) => (
                    <th key={p.id} className={`p-3 sm:p-4 text-center font-bold ${p.popular ? "text-safran bg-safran/5" : "text-ink"}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line/60">
                  <td className="p-3 sm:p-4 text-muted flex items-center gap-1.5"><Headphones size={14} className="text-emerald" /> Musiques</td>
                  {plans.map((p) => (
                    <td key={p.id} className={`p-3 sm:p-4 text-center font-bold ${p.popular ? "bg-safran/5" : ""}`}>{p.songs}</td>
                  ))}
                </tr>
                <tr className="border-b border-line/60">
                  <td className="p-3 sm:p-4 text-muted flex items-center gap-1.5"><Clock size={14} className="text-emerald" /> Durée max</td>
                  {plans.map((p) => (
                    <td key={p.id} className={`p-3 sm:p-4 text-center font-semibold ${p.popular ? "bg-safran/5" : ""}`}>{p.benefits.duration}</td>
                  ))}
                </tr>
                <tr className="border-b border-line/60">
                  <td className="p-3 sm:p-4 text-muted flex items-center gap-1.5"><Shield size={14} className="text-emerald" /> Commercial</td>
                  {plans.map((p) => (
                    <td key={p.id} className={`p-3 sm:p-4 text-center ${p.popular ? "bg-safran/5" : ""}`}>
                      {p.benefits.commercial
                        ? <Check size={16} className="text-emerald mx-auto" />
                        : <span className="text-muted">—</span>
                      }
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-line/60">
                  <td className="p-3 sm:p-4 text-muted flex items-center gap-1.5"><MessageCircle size={14} className="text-emerald" /> Support</td>
                  {plans.map((p) => (
                    <td key={p.id} className={`p-3 sm:p-4 text-center text-xs ${p.popular ? "bg-safran/5" : ""}`}>{p.benefits.support}</td>
                  ))}
                </tr>
                <tr>
                  <td className="p-3 sm:p-4 text-muted">Prix / son</td>
                  {plans.map((p) => (
                    <td key={p.id} className={`p-3 sm:p-4 text-center font-bold ${p.popular ? "bg-safran/5 text-safran" : "text-emerald"}`}>{p.perSong}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
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
