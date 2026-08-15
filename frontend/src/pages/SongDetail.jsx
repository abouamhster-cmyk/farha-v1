import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase, callFunction } from "../lib/supabaseClient.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import ShareModal from "../components/ShareModal.jsx";
import {
  ChevronLeft, Loader2, Download, Unlock, Music, AlertTriangle,
  Globe, User, RefreshCw, Play, Pause, Sparkles, Lock, Share2, Check, ShieldCheck, Mic2, Headphones, CheckCircle2, FileText, RotateCcw, Layers, Plus
} from "lucide-react";

const VARIANT_STATUS_LABEL = {
  draft: "Brouillon",
  lyrics_ready: "Paroles prêtes",
  music_generating: "Composition…",
  preview_ready: "Extrait prêt",
  purchased: "Débloquée",
  completed: "Complète HD",
  failed: "Échec",
};

export default function SongDetail() {
  const { songId } = useParams();
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [song, setSong] = useState(null);
  const [lineage, setLineage] = useState([]);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [regeneratingMusic, setRegeneratingMusic] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [activeLyricsTab, setActiveLyricsTab] = useState("darija");
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);

  const loadSong = useCallback(async () => {
    try {
      const { data, error: dbErr } = await supabase.from("songs").select("*").eq("id", songId).single();
      if (dbErr) throw dbErr;
      setSong(data);
      return data;
    } catch (err) {
      console.error(err);
    }
  }, [songId]);

  useEffect(() => { loadSong(); refreshProfile(); }, [loadSong]);

  // Charge la lignée (toutes les versions de la meme famille).
  useEffect(() => {
    if (!song) return;
    const rootId = song.root_song_id || song.id;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("songs")
        .select("id, occasion, version_number, status, created_at")
        .or(`root_song_id.eq.${rootId},id.eq.${rootId}`)
        .order("version_number", { ascending: true });
      if (!cancelled && data) setLineage(data);
    })();
    return () => { cancelled = true; };
  }, [song?.id, song?.root_song_id, song?.status]);

  async function handleCreateVariant() {
    if (!song) return;
    setError("");
    setCreatingVariant(true);
    try {
      const res = await callFunction("create-variant", { songId: song.id, copyLyrics: true });
      navigate(`/creer?song=${res.songId}&step=${res.startStep || 2}`);
    } catch (err) {
      setError(err?.message || String(err));
      setCreatingVariant(false);
    }
  }

  useEffect(() => {
    if (!song) return;
    const isGenerating = song.status === "music_generating" || song.status === "lyrics_generating";
    if (!isGenerating) return;
    const interval = setInterval(async () => {
      const updated = await loadSong();
      if (updated && updated.status !== "music_generating" && updated.status !== "lyrics_generating") {
        clearInterval(interval);
        refreshProfile();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [song?.status, loadSong, refreshProfile]);

  const songStatus = song?.status;
  const isUnlocked = songStatus === "completed" || songStatus === "purchased";

  useEffect(() => {
    if (!song || !songId) return;

    setAudioLoading(true);
    let cancelled = false;

    const fullPath = song.full_audio_path || `${song.user_id}/${song.id}.mp3`;
    const prevPath = song.preview_audio_path || `${song.user_id}/${song.id}.mp3`;

    async function loadAudioSource() {
      const candidates = isUnlocked
        ? [
            { bucket: "song-full", path: fullPath },
            { bucket: "song-previews", path: prevPath },
            { bucket: "song-previews", path: fullPath },
          ]
        : [
            { bucket: "song-previews", path: prevPath },
            { bucket: "song-full", path: fullPath },
          ];

      let validUrl = null;

      for (const { bucket, path } of candidates) {
        if (!path) continue;
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
        if (pubData?.publicUrl) {
          try {
            const headResp = await fetch(pubData.publicUrl, { method: "HEAD" });
            if (headResp.ok) {
              validUrl = pubData.publicUrl;
              break;
            }
          } catch { /* fallback */ }
        }
        const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (signedData?.signedUrl) {
          validUrl = signedData.signedUrl;
          break;
        }
      }

      if (cancelled) return;

      if (validUrl) {
        setAudioUrl(validUrl);
        setError("");
      } else {
        setError("Fichier audio introuvable dans le stockage.");
      }
      setAudioLoading(false);
    }

    loadAudioSource();

    return () => { cancelled = true; };
  }, [songId, songStatus, isUnlocked, song?.full_audio_path, song?.preview_audio_path]);

  useEffect(() => {
    if (!song || !song.image_path) {
      setCoverUrl(null);
      return;
    }
    let cancelled = false;
    supabase.storage
      .from("song-covers")
      .createSignedUrl(song.image_path, 3600)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setCoverUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [song?.image_path]);

  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.load();
    }
  }, [audioUrl]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await el.play();
      setIsPlaying(true);
    } catch (err) {
      // Souvent l'élément n'est pas encore prêt (src fraîchement changée
      // après une régénération). On force le chargement puis on réessaie
      // dès que la lecture est possible — plus besoin de cliquer 2 fois.
      try {
        el.load();
        await new Promise((resolve) => {
          let done = false;
          const finish = () => { if (!done) { done = true; el.removeEventListener("canplay", finish); resolve(); } };
          el.addEventListener("canplay", finish);
          setTimeout(finish, 2500);
        });
        await el.play();
        setIsPlaying(true);
      } catch (err2) {
        console.error("Erreur lecture audio:", err2);
        setError("Lecture impossible pour le moment. Réessayez dans un instant.");
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration) {
      audioRef.current.currentTime = pos * duration;
    }
  };

  const formatTime = (sec) => {
    if (isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  function handleShare() {
    setShowShareModal(true);
  }

  async function handleUnlock() {
    setError("");
    setUnlocking(true);
    try {
      const { song: updated } = await callFunction("unlock-song", { songId });
      setSong(updated);
      await refreshProfile();
      setUnlockSuccess(true);
      setTimeout(() => setUnlockSuccess(false), 4000);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setUnlocking(false);
    }
  }

  async function handleRegenerateMusic() {
    setShowRegenConfirm(false);
    setError("");
    setRegeneratingMusic(true);
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();
    try {
      await callFunction("regenerate-music", { songId });
      await refreshProfile();
      const { song: updated } = await callFunction("generate-music", { songId, paidRegeneration: true });
      setSong(updated);
      setAudioUrl(null);
    } catch (err) {
      setError(err?.message || String(err));
      await loadSong();
    } finally {
      setRegeneratingMusic(false);
    }
  }

  async function handleDownload() {
    setError("");
    try {
      const path = isUnlocked ? (song.full_audio_path || song.preview_audio_path) : song.preview_audio_path;
      if (!path) throw new Error("Fichier audio introuvable.");

      const tryBuckets = isUnlocked ? ["song-full", "song-previews"] : ["song-previews", "song-full"];
      let downloadedBlob = null;

      for (const bucket of tryBuckets) {
        const { data, error: downloadErr } = await supabase.storage.from(bucket).download(path);
        if (!downloadErr && data) {
          downloadedBlob = data;
          break;
        }
      }

      if (!downloadedBlob) {
        throw new Error("Fichier introuvable dans le stockage.");
      }

      const ext = path.endsWith(".wav") ? "wav" : "mp3";
      const blobUrl = window.URL.createObjectURL(downloadedBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Farha_${song.occasion || "chanson"}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err?.message || String(err));
    }
  }

  if (!song) {
    return (
      <div className="px-4 py-20 flex items-center justify-center">
        <Loader2 size={32} className="text-safran animate-spin" />
      </div>
    );
  }

  const isGenerating = song.status === "lyrics_generating" || song.status === "music_generating";
  const aiCoverImage = coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80";

  return (
    <div className="px-4 sm:px-8 lg:px-12 py-6 lg:py-10 max-w-7xl mx-auto">
      <Link to="/tableau-de-bord" className="text-xs sm:text-sm text-muted hover:text-emerald mb-5 sm:mb-6 inline-flex items-center gap-1.5 font-semibold transition-colors">
        <ChevronLeft size={16} /> Retour au tableau de bord
      </Link>

      {error && (
        <div className="bg-henne/10 text-henne rounded-2xl p-4 mb-5 sm:mb-6 text-xs sm:text-sm border border-henne/20 flex items-center justify-between gap-3 animate-slideDown">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
          <button
            onClick={() => { setError(""); loadSong(); }}
            className="inline-flex items-center gap-1.5 bg-henne text-white px-3.5 py-1.5 rounded-xl font-bold text-xs flex-shrink-0 hover:bg-henne-light cursor-pointer active:scale-[0.97]"
          >
            <RefreshCw size={12} /> Réessayer
          </button>
        </div>
      )}

      {/* Toast de succès déblocage */}
      {unlockSuccess && (
        <div className="bg-emerald/10 text-emerald rounded-2xl px-4 py-3 mb-5 text-xs sm:text-sm flex items-center gap-2 border border-emerald/20 animate-popIn">
          <CheckCircle2 size={16} className="animate-bounceIn" />
          Musique complète débloquée avec succès !
        </div>
      )}

      {/* En-tête Chanson */}
      <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-5 sm:p-8 mb-6 sm:mb-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slideUp">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-safran bg-safran/10 px-3 py-1 rounded-full border border-safran/20">
              {song.occasion || "Projet Musical"}
            </span>
            {isUnlocked ? (
              <span className="badge-music">
                <Mic2 size={12} /> Musique Complète HD
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-muted bg-cream px-2.5 py-0.5 rounded-full border border-line">
                <Lock size={11} /> Extrait 40s
              </span>
            )}
          </div>
          <h1 className="font-display text-xl sm:text-2xl lg:text-4xl font-bold">{song.occasion || "Ma chanson"}</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted flex-wrap">
          {song.recipient_name && (
            <span className="inline-flex items-center gap-1.5 bg-cream px-2.5 py-1.5 rounded-xl border border-line">
              <User size={13} className="text-emerald" /> {song.recipient_name}
            </span>
          )}
          {song.free_mode ? (
            <span className="inline-flex items-center gap-1.5 bg-safran/10 text-safran px-2.5 py-1.5 rounded-xl border border-safran/25 font-semibold">
              <Sparkles size={13} /> Sur mesure
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 bg-cream px-2.5 py-1.5 rounded-xl border border-line capitalize">
                <Globe size={13} className="text-emerald" /> {song.dialect}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-cream px-2.5 py-1.5 rounded-xl border border-line capitalize">
                <Music size={13} className="text-emerald" /> {song.music_style}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">

        {/* COLONNE GAUCHE : LECTEUR + GESTION */}
        <div className="lg:col-span-5 flex flex-col space-y-5 sm:space-y-6">

          {/* Régénération de la musique : indicateur clair */}
          {regeneratingMusic && (
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden p-8 text-center shadow-xl border border-white/15 text-white bg-[#0C0F0E] animate-slideUp">
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-safran/20 rounded-full blur-3xl animate-haloPulse pointer-events-none" />
              <div className="relative z-10">
                <Loader2 size={36} className="text-safran animate-spin mx-auto mb-4" />
                <p className="font-bold text-base">Nouvelle version en cours de composition…</p>
                <p className="text-xs text-white/60 mt-1.5">Cela prend 30 à 45 secondes. La musique se rafraîchira automatiquement.</p>
                <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-safran to-safran-bright rounded-full animate-shimmer" style={{ backgroundSize: "200% 100%" }} />
                </div>
              </div>
            </div>
          )}

          {isGenerating && !regeneratingMusic && (
            <div className="bg-safran/10 border border-safran/30 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-sm">
              <Loader2 size={32} className="text-safran animate-spin mx-auto mb-3" />
              <p className="font-bold text-sm sm:text-base">Composition en cours...</p>
              <p className="text-xs text-muted mt-1">Votre morceau sera pret dans 30 a 45 secondes.</p>
            </div>
          )}

          {(song.status === "preview_ready" || isUnlocked) && audioLoading && !regeneratingMusic && (
            <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center shadow-sm">
              <Loader2 size={32} className="text-safran animate-spin mx-auto mb-3" />
              <p className="font-bold text-sm">Chargement de votre musique...</p>
            </div>
          )}

          {/* LECTEUR AUDIO */}
          {(song.status === "preview_ready" || isUnlocked) && !audioLoading && !regeneratingMusic && (
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden p-5 sm:p-8 shadow-xl border border-white/15 text-white bg-[#0C0F0E] animate-slideUp">
              <div
                className="absolute inset-0 bg-cover bg-center blur-2xl scale-125 opacity-30 pointer-events-none"
                style={{ backgroundImage: `url('${aiCoverImage}')` }}
              />
              <div className="absolute inset-0 bg-[#0C0F0E]/85 backdrop-blur-xl pointer-events-none" />

              <div className="relative z-10 space-y-5 sm:space-y-6">
                {audioUrl && (
                  <audio
                    key={audioUrl}
                    ref={audioRef}
                    src={audioUrl}
                    preload="auto"
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleTimeUpdate}
                    onEnded={() => { setIsPlaying(false); if (!isUnlocked) setPreviewEnded(true); }}
                  />
                )}

                {/* Pochette + Infos */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/20">
                    <img src={aiCoverImage} alt="Pochette d'album" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2">
                      <span className="text-white text-[0.6rem] sm:text-[0.65rem] font-bold uppercase tracking-wider flex items-center gap-1">
                        {isUnlocked
                          ? <><Mic2 size={10} className="text-safran" /> HD Complet</>
                          : <><Lock size={10} /> Extrait 40s</>
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 w-full text-center sm:text-left space-y-2">
                    <h3 className="font-display text-base sm:text-lg lg:text-xl font-bold text-white leading-tight">
                      {song.occasion || "Musique"}
                    </h3>
                    <p className="text-[0.65rem] sm:text-xs text-white/60 uppercase tracking-wider font-semibold">
                      {song.recipient_name ? `${song.recipient_name} · ` : ""}
                      {song.free_mode
                        ? "Sur mesure"
                        : <><span className="capitalize">{song.music_style}</span> ({song.dialect})</>}
                    </p>

                    {isUnlocked && (
                      <button
                        onClick={handleShare}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white border border-white/20 hover:border-safran bg-white/5 hover:bg-white/10 rounded-xl px-3 py-1.5 transition-colors cursor-pointer active:scale-[0.97]"
                      >
                        <Share2 size={13} />
                        Partager
                      </button>
                    )}
                  </div>
                </div>

                {/* Barre de lecture */}
                <div className="space-y-1.5">
                  <div
                    onClick={handleSeek}
                    className="w-full h-2.5 bg-white/15 rounded-full overflow-hidden cursor-pointer relative border border-white/20"
                  >
                    <div
                      className="h-full bg-safran rounded-full transition-[width] duration-100"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[0.65rem] sm:text-xs text-white/50 font-semibold">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Bouton Play/Pause */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={togglePlay}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-safran hover:bg-safran-bright text-ink flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                  </button>
                  <span className="text-xs text-white/80 font-medium">
                    {isPlaying ? "Lecture en cours..." : isUnlocked ? "Écouter la musique complète HD" : "Écouter l'extrait gratuit (40s)"}
                  </span>
                </div>

                {/* Bouton action */}
                {isUnlocked ? (
                  <div className="border-t border-white/15 pt-4 sm:pt-5">
                    <button
                      onClick={handleDownload}
                      className="w-full flex items-center justify-center gap-2 bg-emerald hover:bg-emerald-light text-white font-bold py-3 sm:py-4 rounded-2xl transition-all shadow-lg text-xs sm:text-sm lg:text-base cursor-pointer border border-white/10 active:scale-[0.98]"
                    >
                      <Download size={18} /> Télécharger le MP3 HD Complet
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-white/15 pt-4 sm:pt-5 space-y-3">
                    {previewEnded && (
                      <div className="bg-safran/15 border border-safran/40 rounded-2xl p-3.5 text-center animate-popIn">
                        <p className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                          <Lock size={14} className="text-safran" /> Fin de l'extrait gratuit (40s)
                        </p>
                        <p className="text-xs text-white/75 mt-1 leading-relaxed">
                          Débloquez pour écouter la <strong>chanson complète</strong> et la <strong>partager</strong> avec vos proches.
                        </p>
                      </div>
                    )}
                    <p className="font-bold text-xs sm:text-sm text-white">
                      Vous aimez le morceau ? Débloquez la version complète HD.
                    </p>
                    {(profile?.credits ?? 0) > 0 ? (
                      <button
                        onClick={handleUnlock}
                        disabled={unlocking}
                        className="w-full flex items-center justify-center gap-2 bg-henne hover:bg-henne-light text-white font-bold py-3 sm:py-3.5 rounded-2xl transition-all shadow-lg text-xs sm:text-sm cursor-pointer disabled:opacity-60 active:scale-[0.98]"
                      >
                        {unlocking ? <><Loader2 size={18} className="animate-spin" /> Déblocage...</> : <><Unlock size={18} /> Débloquer le morceau complet ({profile.credits} crédit)</>}
                      </button>
                    ) : (
                      <Link
                        to="/tarifs"
                        className="w-full flex items-center justify-center gap-2 bg-henne hover:bg-henne-light text-white font-bold py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm shadow-lg text-center"
                      >
                        Acheter des crédits pour débloquer
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Carte de gestion unique : sections claires separees par des filets */}
          {song.lyrics && (
            <div className="bg-white border border-line rounded-2xl sm:rounded-3xl shadow-sm divide-y divide-line overflow-hidden animate-slideUp" style={{ animationDelay: "60ms", animationFillMode: "both" }}>

              {/* Section AJUSTER */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 text-[0.7rem] font-bold text-muted uppercase tracking-wider">
                  <RotateCcw size={13} className="text-emerald" /> Ajuster ce projet
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    to={`/creer?song=${song.id}&step=2`}
                    className="flex items-center justify-center gap-1.5 border border-line hover:border-emerald hover:bg-emerald/5 text-muted hover:text-emerald font-bold py-2.5 rounded-xl transition-colors text-xs cursor-pointer active:scale-[0.97]"
                  >
                    <FileText size={14} /> Paroles
                  </Link>
                  <Link
                    to={`/creer?song=${song.id}&step=1`}
                    className="flex items-center justify-center gap-1.5 border border-line hover:border-emerald hover:bg-emerald/5 text-muted hover:text-emerald font-bold py-2.5 rounded-xl transition-colors text-xs cursor-pointer active:scale-[0.97]"
                  >
                    <Sparkles size={14} /> L'idée
                  </Link>
                </div>
              </div>

              {/* Section VERSIONS */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[0.7rem] font-bold text-muted uppercase tracking-wider">
                    <Layers size={13} className="text-emerald" /> Versions
                  </div>
                  {lineage.length > 1 && (
                    <span className="text-[0.65rem] font-bold text-emerald bg-emerald/10 px-2 py-0.5 rounded-full border border-emerald/20">
                      {lineage.length} versions
                    </span>
                  )}
                </div>

                {lineage.length > 1 && (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {lineage.map((v) => {
                      const current = v.id === song.id;
                      return (
                        <Link
                          key={v.id}
                          to={`/chanson/${v.id}`}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
                            current ? "border-emerald bg-emerald/5 text-ink font-bold" : "border-line hover:border-emerald/40 text-muted"
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.65rem] font-bold flex-shrink-0 ${current ? "bg-emerald text-white" : "bg-cream text-muted"}`}>
                              v{v.version_number}
                            </span>
                            <span className="truncate">{VARIANT_STATUS_LABEL[v.status] || v.status}</span>
                          </span>
                          {current && <Check size={13} className="text-emerald flex-shrink-0" />}
                        </Link>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={handleCreateVariant}
                  disabled={creatingVariant}
                  className="w-full flex items-center justify-center gap-2 border border-emerald text-emerald hover:bg-emerald hover:text-white font-bold py-2.5 rounded-xl transition-colors text-xs disabled:opacity-50 cursor-pointer active:scale-[0.97]"
                >
                  {creatingVariant
                    ? <><Loader2 size={14} className="animate-spin" /> Création…</>
                    : <><Plus size={14} /> Créer une nouvelle version</>}
                </button>
                <p className="text-[0.65rem] text-muted leading-relaxed">
                  Repart des mêmes paroles et garde <strong>cette chanson intacte</strong>.
                </p>
              </div>

              {/* Section MUSIQUE (regenerer) — seulement si debloquee */}
              {isUnlocked && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[0.7rem] font-bold text-muted uppercase tracking-wider">
                    <Music size={13} className="text-emerald" /> Musique
                  </div>
                  <button
                    onClick={() => setShowRegenConfirm(true)}
                    disabled={regeneratingMusic || (profile?.credits ?? 0) === 0}
                    className="w-full flex items-center justify-center gap-2 border border-line hover:border-emerald hover:bg-emerald/5 text-muted hover:text-emerald font-bold py-2.5 rounded-xl transition-colors text-xs disabled:opacity-50 cursor-pointer active:scale-[0.97]"
                  >
                    <RefreshCw size={14} /> Régénérer la musique (1 crédit)
                  </button>
                  <p className="text-[0.65rem] text-muted leading-relaxed">
                    Recompose une nouvelle musique sur ces paroles et <strong>remplace</strong> l'actuelle (1 crédit).
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLONNE DROITE : PAROLES */}
        <div className="lg:col-span-7">
          {song.lyrics ? (
            <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm animate-slideUp" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
              <div className="flex items-center justify-between border-b border-line pb-3 sm:pb-4 mb-4 flex-wrap gap-2">
                <h2 className="font-display text-base sm:text-lg lg:text-xl font-bold">Paroles</h2>

                <div className="flex bg-cream p-1 rounded-xl border border-line text-xs font-bold">
                  <button
                    onClick={() => setActiveLyricsTab("darija")}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeLyricsTab === "darija" ? "bg-emerald text-white" : "text-muted hover:text-ink"
                    }`}
                  >
                    Arabe
                  </button>
                  {song.lyrics_fr && (
                    <button
                      onClick={() => setActiveLyricsTab("french")}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        activeLyricsTab === "french" ? "bg-emerald text-white" : "text-muted hover:text-ink"
                      }`}
                    >
                      Français
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-cream rounded-2xl p-4 sm:p-6 border border-line/60 overflow-y-auto max-h-[65vh]">
                {activeLyricsTab === "darija" ? (
                  <p className="font-arabic text-right text-base sm:text-lg lg:text-2xl leading-loose whitespace-pre-wrap" dir="rtl">
                    {song.lyrics}
                  </p>
                ) : (
                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-muted">
                    {song.lyrics_fr}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-8 text-center text-muted text-sm flex items-center justify-center min-h-[200px]">
              Aucune parole enregistrée pour ce morceau.
            </div>
          )}
        </div>

      </div>

      <ConfirmModal
        open={showRegenConfirm}
        onCancel={() => setShowRegenConfirm(false)}
        onConfirm={handleRegenerateMusic}
        title="Régénérer la musique ?"
        confirmLabel="Régénérer (1 crédit)"
        confirmColor="bg-emerald hover:bg-emerald-light"
      >
        <p>Une nouvelle version musicale sera composée avec les mêmes paroles. Cela consommera <strong>1 crédit</strong> de votre solde.</p>
        <p className="mt-2">Crédits restants : <strong className="text-safran">{profile?.credits ?? 0}</strong></p>
      </ConfirmModal>

      {showShareModal && song && (
        <ShareModal
          song={song}
          coverUrl={coverUrl}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
