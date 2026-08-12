import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import {
  Music, Disc3, CheckCircle2, Clock, Pen, FileText, Headphones,
  AlertTriangle, Loader2, PlusCircle, Sparkles, Mic2,
  Heart, GraduationCap, Baby, Gift, PartyPopper, Star, ChevronRight, ArrowRight,
  Video, Store, Laugh
} from "lucide-react";

const STATUS_CONFIG = {
  draft:             { label: "Brouillon",       Icon: Pen,          color: "bg-muted/10 text-muted",     accent: "border-l-muted" },
  lyrics_generating: { label: "Écriture…",       Icon: Loader2,      color: "bg-safran-bg text-safran",   accent: "border-l-safran" },
  lyrics_ready:      { label: "Paroles prêtes",  Icon: FileText,     color: "bg-safran-bg text-safran",   accent: "border-l-safran" },
  music_generating:  { label: "Composition…",    Icon: Loader2,      color: "bg-safran-bg text-safran",   accent: "border-l-safran" },
  preview_ready:     { label: "Extrait prêt",    Icon: Headphones,   color: "bg-emerald/10 text-emerald font-bold", accent: "border-l-emerald" },
  purchased:         { label: "Déblocage…",      Icon: Clock,        color: "bg-emerald/10 text-emerald", accent: "border-l-emerald" },
  completed:         { label: "Audio prêt",      Icon: CheckCircle2, color: "bg-emerald text-white font-bold",      accent: "border-l-emerald" },
  failed:            { label: "Échec",           Icon: AlertTriangle,color: "bg-henne/10 text-henne",     accent: "border-l-henne" },
};

function getOccasionIcon(occasion) {
  if (!occasion) return Music;
  const lower = occasion.toLowerCase();
  if (lower.includes("tiktok") || lower.includes("reel")) return Video;
  if (lower.includes("pub") || lower.includes("business") || lower.includes("commerce")) return Store;
  if (lower.includes("humour") || lower.includes("meme") || lower.includes("parodie")) return Laugh;
  if (lower.includes("anniversaire")) return Gift;
  if (lower.includes("mariage"))      return Heart;
  if (lower.includes("naissance"))    return Baby;
  if (lower.includes("fête") || lower.includes("aïd")) return PartyPopper;
  return Mic2;
}

export default function Dashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  async function loadSongs() {
    const { data } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    setSongs(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadSongs(); }, [user?.id]);

  // VÉRIFICATION EN DEUX TEMPS DU RETOUR DE PAIEMENT (INSTANTANÉE + DELAYED)
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      refreshProfile(); // 1er rafraîchissement immédiat
      
      // 2ème rafraîchissement 1.8s plus tard pour laisser le temps au Webhook de créditer
      const timer = setTimeout(() => {
        refreshProfile();
        loadSongs();
      }, 1800);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const credits = profile?.credits ?? 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const completedCount = songs.filter(s => s.status === "completed" || s.status === "preview_ready").length;

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-6 lg:py-10 max-w-7xl mx-auto">

      {/* Message de succès d'achat si retour de paiement */}
      {searchParams.get("checkout") === "success" && (
        <div className="bg-emerald/10 text-emerald rounded-2xl p-4 sm:p-5 mb-6 text-sm border border-emerald/20 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2.5 font-bold">
            <CheckCircle2 size={20} className="text-emerald flex-shrink-0" />
            <span>Paiement réussi ! Vos nouveaux crédits ont été ajoutés à votre solde.</span>
          </div>
        </div>
      )}

      {/* Header Accueil */}
      <div className="bg-white border border-line rounded-3xl p-6 sm:p-8 mb-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="text-muted text-xs sm:text-sm font-medium mb-1">{greeting}</div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold flex items-center gap-3 flex-wrap">
            <span>{firstName || "Créateur"}</span>
            <span className="font-arabic text-safran text-lg sm:text-2xl bg-safran/10 px-3 py-1 rounded-xl border border-safran/20">
              مرحبا بكم
            </span>
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-2">
            Composez vos musiques d'exception et pochettes d'album dédicacées en Darija, Égyptien ou Fusha.
          </p>
        </div>
        <Link
          to="/creer"
          className="inline-flex items-center justify-center gap-2.5 bg-henne hover:bg-henne-light text-white font-bold px-7 py-4 rounded-2xl shadow-[0_10px_25px_rgba(184,58,40,0.3)] transition-all hover:-translate-y-0.5 text-sm sm:text-base flex-shrink-0"
        >
          <PlusCircle size={20} /> Nouvelle Création
        </Link>
      </div>

      {/* Compteurs Cartes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
        {[
          { label: "Crédits disponibles", value: credits, Icon: Sparkles, iconColor: "text-safran", bg: "bg-safran/10" },
          { label: "Musiques composées",   value: songs.length, Icon: Disc3, iconColor: "text-emerald", bg: "bg-emerald/10" },
          { label: "Prêtes à télécharger", value: completedCount, Icon: CheckCircle2, iconColor: "text-emerald", bg: "bg-emerald/10" },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-line rounded-2xl p-5 sm:p-6 flex items-center gap-4 shadow-sm">
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <stat.Icon size={24} className={stat.iconColor} />
            </div>
            <div className="min-w-0">
              <div className="font-display text-3xl font-bold leading-none">{stat.value}</div>
              <div className="text-muted text-xs sm:text-sm mt-1 truncate">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Section Mes Musiques */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Music size={22} className="text-safran" /> Vos Réalisations Musicales
        </h2>
        {songs.length > 0 && (
          <Link to="/creer" className="text-xs sm:text-sm font-semibold text-emerald hover:text-emerald-light transition-colors flex items-center gap-1.5 bg-emerald/10 px-3.5 py-2 rounded-xl">
            <PlusCircle size={15} /> Nouvelle création
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white border border-line rounded-3xl">
          <Loader2 size={32} className="text-safran animate-spin" />
        </div>
      ) : songs.length === 0 ? (
        <div className="bg-white border border-line rounded-3xl text-center py-16 px-6 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-safran/15 flex items-center justify-center mx-auto mb-4">
            <Mic2 size={32} className="text-safran" />
          </div>
          <h3 className="font-display text-2xl font-bold mb-2">Votre première création vous attend</h3>
          <p className="text-muted max-w-[480px] mx-auto mb-8 text-sm leading-relaxed">
            Composez un morceau sur-mesure pour vos réseaux sociaux, publicités de marque ou événements de famille.
          </p>
          <Link
            to="/creer"
            className="inline-flex items-center gap-2.5 bg-henne hover:bg-henne-light text-white font-bold px-8 py-4 rounded-2xl shadow-md transition-all hover:-translate-y-0.5 text-base"
          >
            Lancer ma première création <ArrowRight size={18} />
          </Link>
        </div>
      ) : (
        /* Grille 3 colonnes sur desktop */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {songs.map((song) => {
            const status = STATUS_CONFIG[song.status] ?? STATUS_CONFIG.draft;
            const OccIcon = getOccasionIcon(song.occasion);
            const isAnimated = song.status === "lyrics_generating" || song.status === "music_generating";

            return (
              <Link
                to={`/chanson/${song.id}`}
                key={song.id}
                className={`group bg-white rounded-2xl border border-line hover:border-emerald/40 hover:shadow-md transition-all overflow-hidden border-l-4 ${status.accent} p-5 sm:p-6 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center flex-shrink-0">
                      <OccIcon size={20} className="text-emerald" />
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${status.color}`}>
                      <status.Icon size={12} className={isAnimated ? "animate-spin" : ""} />
                      {status.label}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-lg mb-1 group-hover:text-emerald transition-colors line-clamp-1">
                    {song.occasion || "Musique personnalisée"}
                  </h3>

                  <p className="text-muted text-xs sm:text-sm mb-4">
                    {song.recipient_name ? `Sujet : ${song.recipient_name} · ` : ""}
                    <span className="capitalize">{song.dialect}</span> · <span className="capitalize">{song.music_style}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-line/60 text-xs text-muted">
                  <span>
                    {new Date(song.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="font-semibold text-emerald flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Ouvrir <ChevronRight size={14} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}