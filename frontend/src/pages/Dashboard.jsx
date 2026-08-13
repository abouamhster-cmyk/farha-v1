// src/pages/Dashboard.jsx

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase, callFunction } from "../lib/supabaseClient.js";
import {
  Music, Disc3, CheckCircle2, Clock, Pen, FileText, Headphones,
  AlertTriangle, Loader2, PlusCircle, Sparkles, Mic2,
  Heart, Baby, Gift, PartyPopper, ChevronRight, ArrowRight,
  Video, Store, Laugh, Search, Filter, RotateCcw, Crown, ShieldCheck, Zap,
  XCircle
} from "lucide-react";

const STATUS_CONFIG = {
  draft:             { label: "Brouillon",       Icon: Pen,          color: "bg-muted/10 text-muted",     accent: "border-l-muted" },
  lyrics_generating: { label: "Écriture…",       Icon: Loader2,      color: "bg-safran/15 text-safran font-bold", accent: "border-l-safran" },
  lyrics_ready:      { label: "Paroles prêtes",  Icon: FileText,     color: "bg-safran/15 text-safran font-bold", accent: "border-l-safran" },
  music_generating:  { label: "Composition…",    Icon: Loader2,      color: "bg-safran/15 text-safran font-bold", accent: "border-l-safran" },
  preview_ready:     { label: "Extrait prêt",    Icon: Headphones,   color: "bg-emerald/15 text-emerald font-bold", accent: "border-l-emerald" },
  purchased:         { label: "Déblocage…",      Icon: Clock,        color: "bg-emerald/15 text-emerald font-bold", accent: "border-l-emerald" },
  completed:         { label: "Audio prêt",      Icon: CheckCircle2, color: "bg-emerald text-white font-bold shadow-xs", accent: "border-l-emerald" },
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
  const [searchParams, setSearchParams] = useSearchParams();

  const PAGE_SIZE = 20;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // États pour le paiement
  const [paymentStatus, setPaymentStatus] = useState(null); // null | "checking" | "success" | "pending" | "canceled" | "failed" | "error" | "timeout"
  const [paymentMessage, setPaymentMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  async function loadSongs(pageNum = 0, append = false) {
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);
    const results = data ?? [];
    setHasMore(results.length === PAGE_SIZE);
    setSongs(prev => append ? [...prev, ...results] : results);
    setLoading(false);
  }

  useEffect(() => { loadSongs(); }, [user?.id]);

  // ✅ Gestion du retour de paiement - VERSION CORRIGÉE
  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    const fedapayStatus = searchParams.get("status");
    const transactionId = searchParams.get("id");
    const paypalToken = searchParams.get("token");
    const paymentId = searchParams.get("paymentId");
    const PayerID = searchParams.get("PayerID");

    // ✅ Fonction pour nettoyer l'URL
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("status");
      url.searchParams.delete("id");
      url.searchParams.delete("token");
      url.searchParams.delete("paymentId");
      url.searchParams.delete("PayerID");
      window.history.replaceState({}, "", url.toString());
    };

    // ✅ Vérifier si on revient d'un paiement
    const isReturningFromPayment = 
      checkoutStatus === "success" || 
      fedapayStatus === "approved" ||
      paypalToken ||
      paymentId;

    // ✅ Si on revient d'un paiement ET qu'on n'est pas déjà en train de vérifier
    if (isReturningFromPayment && !isVerifying) {
      setIsVerifying(true);
      setPaymentStatus("checking");
      setPaymentMessage("⏳ Vérification de votre paiement en cours...");

      callFunction("verify-payment", {
        transactionId: transactionId || paymentId || null,
      })
        .then((res) => {
          console.log("Réponse verify-payment:", res);
          
          if (res?.success) {
            setPaymentStatus("success");
            setPaymentMessage(`✅ Paiement confirmé ! +${res.creditsGranted || ""} crédits ajoutés.`);
            refreshProfile();
            loadSongs();
            // ✅ Nettoyer l'URL après succès
            setTimeout(cleanUrl, 5000);
          } else if (res?.status === "pending") {
            setPaymentStatus("pending");
            setPaymentMessage("⏳ Paiement en attente de confirmation. Revenez dans quelques instants.");
            // ✅ Ne pas nettoyer l'URL, l'utilisateur doit pouvoir revenir
          } else if (res?.status === "canceled") {
            setPaymentStatus("canceled");
            setPaymentMessage("❌ Vous avez annulé le paiement. Aucun crédit n'a été débité.");
            setTimeout(cleanUrl, 6000);
          } else if (res?.status === "not_found") {
            setPaymentStatus("failed");
            setPaymentMessage("❌ Aucune commande en attente trouvée.");
            setTimeout(cleanUrl, 5000);
          } else {
            setPaymentStatus("failed");
            setPaymentMessage(`❌ ${res?.message || "Le paiement n'a pas abouti. Veuillez réessayer."}`);
            setTimeout(cleanUrl, 6000);
          }
          setIsVerifying(false);
        })
        .catch((err) => {
          console.error("Erreur vérification:", err);
          setPaymentStatus("error");
          setPaymentMessage("❌ Erreur lors de la vérification du paiement. Contactez le support.");
          setTimeout(cleanUrl, 7000);
          setIsVerifying(false);
        });

      // ✅ Timeout de sécurité
      const timeout = setTimeout(() => {
        if (isVerifying) {
          setPaymentStatus("timeout");
          setPaymentMessage("⏳ La vérification prend plus de temps que prévu. Rechargez la page dans quelques instants.");
          setIsVerifying(false);
        }
      }, 20000);

      return () => clearTimeout(timeout);
    }
  }, [searchParams, refreshProfile, loadSongs, isVerifying]);

  // LOGIQUE DE FILTRAGE DYNAMIQUE
  const filteredSongs = songs.filter((song) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (song.occasion || "").toLowerCase();
      const target = (song.recipient_name || "").toLowerCase();
      const brief = (song.brief || "").toLowerCase();
      const dialect = (song.dialect || "").toLowerCase();
      const style = (song.music_style || "").toLowerCase();

      if (!title.includes(q) && !target.includes(q) && !brief.includes(q) && !dialect.includes(q) && !style.includes(q)) {
        return false;
      }
    }

    if (selectedCategory !== "all") {
      const occ = (song.occasion || "").toLowerCase();
      if (selectedCategory === "tiktok" && !occ.includes("tiktok") && !occ.includes("reel")) return false;
      if (selectedCategory === "pub" && !occ.includes("pub") && !occ.includes("business") && !occ.includes("commerce")) return false;
      if (selectedCategory === "humour" && !occ.includes("humour") && !occ.includes("parodie") && !occ.includes("meme")) return false;
      if (selectedCategory === "fete" && !occ.includes("mariage") && !occ.includes("fête") && !occ.includes("anniversaire") && !occ.includes("naissance")) return false;
    }

    if (selectedStatus !== "all") {
      if (selectedStatus === "ready" && song.status !== "completed" && song.status !== "preview_ready") return false;
      if (selectedStatus === "generating" && song.status !== "music_generating" && song.status !== "lyrics_generating") return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
    if (sortBy === "title") return (a.occasion || "").localeCompare(b.occasion || "");
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const credits = profile?.credits ?? 0;
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const completedCount = songs.filter(s => s.status === "completed" || s.status === "preview_ready").length;

  // ✅ Fonction pour réessayer le paiement
  const handleRetry = () => {
    setPaymentStatus(null);
    setPaymentMessage("");
    // Nettoyer l'URL
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("status");
    url.searchParams.delete("id");
    url.searchParams.delete("token");
    url.searchParams.delete("paymentId");
    url.searchParams.delete("PayerID");
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-6 lg:py-10 max-w-7xl mx-auto space-y-8">

      {/* ✅ Messages de statut de paiement - UNIQUEMENT basés sur l'état, PAS sur l'URL */}
      {paymentStatus === "checking" && (
        <div className="bg-safran/10 border border-safran/30 rounded-2xl p-4 mb-6 flex items-center gap-3 animate-pulse">
          <Loader2 size={20} className="text-safran animate-spin" />
          <span className="text-sm font-medium text-ink">{paymentMessage}</span>
        </div>
      )}

      {paymentStatus === "success" && (
        <div className="bg-emerald/10 border border-emerald/20 rounded-2xl p-4 mb-6 flex items-center gap-3 animate-popIn">
          <CheckCircle2 size={20} className="text-emerald flex-shrink-0" />
          <span className="text-sm font-medium text-emerald">{paymentMessage}</span>
        </div>
      )}

      {paymentStatus === "pending" && (
        <div className="bg-safran/10 border border-safran/30 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Clock size={20} className="text-safran flex-shrink-0" />
          <span className="text-sm font-medium text-ink">{paymentMessage}</span>
        </div>
      )}

      {paymentStatus === "canceled" && (
        <div className="bg-henne/10 border border-henne/20 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3 animate-slideDown">
          <div className="flex items-center gap-3">
            <XCircle size={20} className="text-henne flex-shrink-0" />
            <span className="text-sm font-medium text-henne">{paymentMessage}</span>
          </div>
          <Link 
            to="/tarifs" 
            className="bg-henne text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-henne-light transition-colors flex-shrink-0"
            onClick={handleRetry}
          >
            Réessayer
          </Link>
        </div>
      )}

      {(paymentStatus === "failed" || paymentStatus === "error" || paymentStatus === "timeout") && (
        <div className="bg-henne/10 border border-henne/20 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3 animate-slideDown">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-henne flex-shrink-0" />
            <span className="text-sm font-medium text-henne">{paymentMessage}</span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {paymentStatus === "timeout" && (
              <button 
                onClick={() => window.location.reload()}
                className="bg-emerald text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-light transition-colors"
              >
                Recharger
              </button>
            )}
            <Link 
              to="/tarifs" 
              className="bg-henne text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-henne-light transition-colors"
              onClick={handleRetry}
            >
              Réessayer
            </Link>
          </div>
        </div>
      )}

      {/* HEADER BANNIÈRE STUDIO */}
      <div className="relative rounded-3xl p-6 sm:p-10 shadow-xl overflow-hidden border border-safran/30 text-white bg-[#0C0F0E]">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-safran/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-safran">
              <Crown size={14} className="text-safran" />
              {greeting}, {firstName || "Créateur"}
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold flex items-center gap-3 flex-wrap">
              <span>Vos chansons</span>
              <span className="font-arabic text-safran text-lg sm:text-2xl bg-white/10 px-3 py-1 rounded-xl border border-white/15 backdrop-blur-sm">
                مرحبا بكم
              </span>
            </h1>
            <p className="text-white/70 text-xs sm:text-sm max-w-[580px] leading-relaxed">
              Créez des chansons en Darija, Égyptien, Fusha et plus.
            </p>
          </div>

          <Link
            to="/creer"
            className="inline-flex items-center justify-center gap-2.5 bg-henne hover:bg-henne-light text-white font-bold px-8 py-4 rounded-2xl shadow-[0_10px_25px_rgba(184,58,40,0.45)] transition-all hover:-translate-y-0.5 text-base flex-shrink-0 cursor-pointer border border-white/10"
          >
            <PlusCircle size={20} /> Nouvelle chanson →
          </Link>
        </div>
      </div>

      {/* COMPTEURS CARTES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-safran/30 rounded-2xl p-5 sm:p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
          <div className="w-13 h-13 rounded-2xl bg-safran/15 text-safran flex items-center justify-center flex-shrink-0 shadow-inner">
            <Sparkles size={26} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-ink leading-none">{credits}</div>
            <div className="text-muted text-xs sm:text-sm font-semibold mt-1 truncate">Crédits disponibles</div>
          </div>
          <Link to="/tarifs" className="ml-auto text-xs font-bold text-safran bg-safran/10 hover:bg-safran/20 px-3 py-1.5 rounded-xl border border-safran/30 transition-colors flex-shrink-0">
            Recharger
          </Link>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 sm:p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
          <div className="w-13 h-13 rounded-2xl bg-emerald/10 text-emerald flex items-center justify-center flex-shrink-0">
            <Disc3 size={26} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-ink leading-none">{songs.length}</div>
            <div className="text-muted text-xs sm:text-sm font-semibold mt-1 truncate">Musiques composées</div>
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl p-5 sm:p-6 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
          <div className="w-13 h-13 rounded-2xl bg-emerald/15 text-emerald flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={26} />
          </div>
          <div className="min-w-0">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-ink leading-none">{completedCount}</div>
            <div className="text-muted text-xs sm:text-sm font-semibold mt-1 truncate">Prêtes à télécharger</div>
          </div>
        </div>
      </div>

      {/* PANNEAU DE RECHERCHE */}
      {songs.length > 0 && (
        <div className="bg-white border border-line rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                className="input-field pl-10 text-xs sm:text-sm"
                placeholder="Chercher par prénom, marque, sujet, style ou dialecte..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="input-field text-xs sm:text-sm cursor-pointer w-full md:w-48 min-w-0 font-medium"
            >
              <option value="all">Tous les statuts</option>
              <option value="ready">Audio Prêt (Prêts)</option>
              <option value="generating">En cours de création</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field text-xs sm:text-sm cursor-pointer w-full md:w-44 min-w-0 font-medium"
            >
              <option value="newest">Plus récentes d'abord</option>
              <option value="oldest">Plus anciennes d'abord</option>
              <option value="title">A - Z (Ordre alphabétique)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: "all", label: "Toutes les catégories", Icon: Filter },
              { id: "tiktok", label: "TikTok & Reels", Icon: Video },
              { id: "pub", label: "Pub & Business", Icon: Store },
              { id: "humour", label: "Humour & Memes", Icon: Laugh },
              { id: "fete", label: "Mariage & Fêtes", Icon: PartyPopper },
            ].map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-safran text-ink shadow-xs"
                      : "bg-cream text-muted hover:bg-line hover:text-ink"
                  }`}
                >
                  <cat.Icon size={14} className={active ? "text-ink" : "text-emerald"} />
                  <span>{cat.label}</span>
                </button>
              );
            })}

            {(searchQuery || selectedCategory !== "all" || selectedStatus !== "all" || sortBy !== "newest") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedStatus("all");
                  setSortBy("newest");
                }}
                className="ml-auto text-xs font-bold text-henne hover:underline flex items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <RotateCcw size={12} /> Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}

      {/* SECTION MES MUSIQUES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Music size={22} className="text-safran" /> Vos Réalisations Musicales ({filteredSongs.length})
          </h2>
          {songs.length > 0 && (
            <Link to="/creer" className="text-xs sm:text-sm font-bold text-emerald hover:text-emerald-light transition-colors flex items-center gap-1.5 bg-emerald/10 px-4 py-2 rounded-xl border border-emerald/20">
              <PlusCircle size={16} /> Nouvelle création
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white border border-line rounded-3xl">
            <Loader2 size={32} className="text-safran animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <div className="bg-white border border-line rounded-3xl text-center py-16 px-6 shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-safran/15 flex items-center justify-center mx-auto text-safran shadow-inner">
              <Mic2 size={32} />
            </div>
            <h3 className="font-display text-2xl font-bold">Pas encore de chanson</h3>
            <p className="text-muted max-w-[480px] mx-auto text-xs sm:text-sm leading-relaxed">
              Créez votre première chanson pour vos réseaux, vos pubs ou vos fêtes de famille.
            </p>
            <Link
              to="/creer"
              className="inline-flex items-center gap-2.5 bg-henne hover:bg-henne-light text-white font-bold px-8 py-4 rounded-2xl shadow-md transition-all hover:-translate-y-0.5 text-base cursor-pointer"
            >
              Lancer ma première création <ArrowRight size={18} />
            </Link>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="bg-white border border-line rounded-3xl text-center py-12 px-6 shadow-sm space-y-3">
            <p className="font-bold text-base">Aucune musique ne correspond à vos filtres.</p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setSelectedStatus("all");
                setSortBy("newest");
              }}
              className="text-xs font-bold text-safran hover:underline inline-flex items-center gap-1 bg-safran/10 px-4 py-2 rounded-xl border border-safran/20 cursor-pointer"
            >
              <RotateCcw size={14} /> Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSongs.map((song) => {
                const status = STATUS_CONFIG[song.status] ?? STATUS_CONFIG.draft;
                const OccIcon = getOccasionIcon(song.occasion);
                const isAnimated = song.status === "lyrics_generating" || song.status === "music_generating";

                return (
                  <Link
                    to={`/chanson/${song.id}`}
                    key={song.id}
                    className={`group bg-white rounded-2xl border border-line/80 hover:border-safran/50 hover:shadow-lg transition-all overflow-hidden border-l-4 ${status.accent} p-5 sm:p-6 flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center flex-shrink-0 text-emerald">
                          <OccIcon size={20} />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${status.color}`}>
                          <status.Icon size={12} className={isAnimated ? "animate-spin" : ""} />
                          {status.label}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-lg mb-1 group-hover:text-emerald transition-colors line-clamp-1">
                        {song.occasion || "Ma chanson"}
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
                      <span className="font-bold text-emerald flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Ouvrir <ChevronRight size={14} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {hasMore && filteredSongs.length >= PAGE_SIZE && (
              <div className="text-center pt-6">
                <button
                  onClick={() => { const next = page + 1; setPage(next); loadSongs(next, true); }}
                  className="inline-flex items-center gap-2 border border-line text-muted hover:text-emerald hover:border-emerald font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer text-sm"
                >
                  Voir plus
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}