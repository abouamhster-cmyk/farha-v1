import { Play, Sparkles, Heart, Gift, Music } from "lucide-react";

// Aperçu fidèle de la page destinataire, réutilisé dans le modal de
// partage. Deux états, comme la vraie page :
//   - personalized : la carte de révélation (dédicace du sender)
//   - direct       : le lecteur immersif (sans titre ni notes)
export default function SharePreview({ mode, coverUrl, senderName, message, photoPreview }) {
  const isPerso = mode === "personalized";

  return (
    <div className="relative w-full rounded-[26px] overflow-hidden bg-[#0C0F0E] border border-white/10 shadow-2xl">
      {/* Ambiance : pochette floutée + halos */}
      {coverUrl && (
        <div className="absolute inset-0 bg-cover bg-center blur-2xl scale-125 opacity-30" style={{ backgroundImage: `url('${coverUrl}')` }} />
      )}
      <div className="absolute inset-0 bg-[#0C0F0E]/75" />
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-safran/20 rounded-full blur-3xl animate-haloPulse pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-henne/20 rounded-full blur-3xl animate-haloPulse pointer-events-none" style={{ animationDelay: "1.2s" }} />

      <div className="relative z-10 p-6 flex flex-col items-center text-center">
        {isPerso ? (
          <>
            {/* Photo / icône expéditeur avec halo doré */}
            <div className="relative w-20 h-20 mb-4">
              <div className="absolute inset-0 rounded-full bg-safran/40 blur-lg animate-haloPulse" />
              {photoPreview ? (
                <img src={photoPreview} alt="" className="relative w-20 h-20 rounded-full object-cover border-[3px] border-safran/60 shadow-lg" />
              ) : (
                <div className="relative w-20 h-20 rounded-full bg-safran/15 border-[3px] border-safran/40 flex items-center justify-center">
                  <Gift size={26} className="text-safran" />
                </div>
              )}
            </div>

            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-safran flex items-center gap-1 mb-1.5">
              <Sparkles size={10} /> Une surprise rien que pour vous
            </p>
            <h3 className="font-display text-lg font-bold text-white leading-snug mb-2">
              {(senderName?.trim() || "Votre nom")} vous a dédié une chanson
            </h3>

            {message?.trim() && (
              <div className="bg-white/[0.06] backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 w-full mb-3">
                <p className="text-xs text-white/80 italic leading-relaxed">"{message.trim()}"</p>
                <p className="text-[0.65rem] font-bold text-safran mt-1.5 flex items-center justify-end gap-1">
                  <Heart size={9} fill="currentColor" /> {senderName?.trim() || "Votre nom"}
                </p>
              </div>
            )}

            <div className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-safran to-henne text-white font-bold py-2.5 rounded-xl text-sm shadow-lg">
              <Play size={14} fill="currentColor" className="ml-0.5" /> Découvrir la chanson
            </div>
          </>
        ) : (
          <>
            {/* Pochette + lecteur immersif (sans titre ni notes) */}
            <div className="relative w-32 h-32 mb-5">
              <div className="absolute -inset-3 rounded-[26px] bg-gradient-to-br from-safran/40 to-henne/40 blur-xl opacity-60" />
              <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald via-[#0C0F0E] to-henne flex items-center justify-center">
                    <Music size={28} className="text-white/40" />
                  </div>
                )}
              </div>
            </div>

            <div className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-safran flex items-center gap-1 mb-4">
              <Sparkles size={10} /> Farha
            </div>

            <div className="w-full h-1.5 bg-white/10 rounded-full mb-4 overflow-hidden">
              <div className="h-full w-1/4 bg-gradient-to-r from-safran to-safran-bright rounded-full" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-safran to-henne text-white flex items-center justify-center shadow-lg">
                <Play size={18} fill="currentColor" className="ml-0.5" />
              </div>
              <div className="flex items-end gap-0.5 h-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="w-0.5 rounded-full bg-safran/70" style={{ height: `${40 + (i % 3) * 25}%` }} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
