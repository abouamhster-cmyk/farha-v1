import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase, callFunction } from "../lib/supabaseClient.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import {
  ChevronLeft, Loader2, Download, Unlock, Music, AlertTriangle,
  Globe, User, RefreshCw, Play, Pause, Sparkles, Lock, Share2, Check, ShieldCheck, Mic2, Headphones, CheckCircle2
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function SongDetail() {
  const { songId } = useParams();
  const { profile, refreshProfile } = useAuth();
  const [song, setSong] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [error, setError] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [regeneratingMusic, setRegeneratingMusic] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [activeLyricsTab, setActiveLyricsTab] = useState("darija");
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);

  const [audioReady, setAudioReady] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [revealPage, setRevealPage] = useState(false);

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

  useEffect(() => {
    if (!audioUrl) { setAudioReady(false); return; }
    const a = new Audio(audioUrl);
    a.addEventListener("canplaythrough", () => setAudioReady(true), { once: true });
    a.load();
    return () => { a.src = ""; };
  }, [audioUrl]);

  useEffect(() => {
    if (!coverUrl) { setImageReady(true); return; }
    setImageReady(false);
    const img = new Image();
    img.onload = () => setImageReady(true);
    img.onerror = () => setImageReady(true);
    img.src = coverUrl;
  }, [coverUrl]);

  const isGeneratingStatus = song?.status === "lyrics_generating" || song?.status === "music_generating";
  const assetsReady = isGeneratingStatus || (audioReady && imageReady);

  useEffect(() => {
    if (song && assetsReady && !revealPage) {
      const t = setTimeout(() => setRevealPage(true), 300);
      return () => clearTimeout(t);
    }
  }, [song, assetsReady, revealPage]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Erreur lecture audio:", err);
      setError("Impossible de lire le fichier audio.");
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

  async function handleShare() {
    const shareUrl = `${SUPABASE_URL}/functions/v1/share-meta?songId=${songId}`;
    const shareText = `Écoute la musique en Darija créée sur Farha`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Farha Studio", text: shareText, url: shareUrl });
        return;
      } catch { return; }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setError("Impossible de copier le lien.");
    }
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

  if (!song || !revealPage) {
    return (
      <div className="px-4 py-20 flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald to-[#0C0F0E] flex items-center justify-center shadow-xl">
            <Music size={32} className="text-safran" />
          </div>
          <Loader2 size={22} className="text-safran animate-spin absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="font-display font-bold text-base sm:text-lg">Préparation de votre morceau...</p>
          <p className="text-xs text-muted">Image et musique en cours de chargement</p>
        </div>
        <div className="w-48 h-1.5 bg-line rounded-full overflow-hidden">
          <div className="h-full bg-safran rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  const isGenerating = song.status === "lyrics_generating" || song.status === "music_generating";
  const aiCoverImage = coverUrl || null;

  return (
    <div className="px-4 sm:px-8 lg:px-12 py-6 lg:py-10 max-w-7xl mx-auto animate-fadeIn">
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
                <Lock size={11} /> Extrait 30s
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
          <span className="inline-flex items-center gap-1.5 bg-cream px-2.5 py-1.5 rounded-xl border border-line capitalize">
            <Globe size={13} className="text-emerald" /> {song.dialect}
          </span>
          <span className="inline-flex items-center gap-1.5 bg-cream px-2.5 py-1.5 rounded-xl border border-line capitalize">
            <Music size={13} className="text-emerald" /> {song.music_style}
          </span>
        </div>
      </div>

      {/* 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">

        {/* COLONNE GAUCHE : LECTEUR */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-5 sm:space-y-6">

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
              {aiCoverImage && (
                <div
                  className="absolute inset-0 bg-cover bg-center blur-2xl scale-125 opacity-30 pointer-events-none"
                  style={{ backgroundImage: `url('${aiCoverImage}')` }}
                />
              )}
              <div className="absolute inset-0 bg-[#0C0F0E]/85 backdrop-blur-xl pointer-events-none" />

              <div className="relative z-10 space-y-5 sm:space-y-6">
                {audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />
                )}

                {/* Pochette + Infos */}
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-40 lg:h-40 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/20">
                    {aiCoverImage ? (
                      <img src={aiCoverImage} alt="Pochette d'album" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald to-[#0C0F0E] flex items-center justify-center">
                        <Music size={36} className="text-safran/60" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2">
                      <span className="text-white text-[0.6rem] sm:text-[0.65rem] font-bold uppercase tracking-wider flex items-center gap-1">
                        {isUnlocked
                          ? <><Mic2 size={10} className="text-safran" /> HD Complet</>
                          : <><Lock size={10} /> Extrait 30s</>
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
                      <span className="capitalize">{song.music_style}</span> ({song.dialect})
                    </p>

                    <button
                      onClick={handleShare}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:text-white border border-white/20 hover:border-safran bg-white/5 hover:bg-white/10 rounded-xl px-3 py-1.5 transition-colors cursor-pointer active:scale-[0.97]"
                    >
                      {shareCopied ? <Check size={13} className="text-emerald animate-popIn" /> : <Share2 size={13} />}
                      {shareCopied ? "Lien copié !" : "Partager"}
                    </button>
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
                    {isPlaying ? "Lecture en cours..." : isUnlocked ? "Écouter la musique complète HD" : "Écouter l'extrait gratuit (30s)"}
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

          {/* Regenerer */}
          {isUnlocked && (
            <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm">
              <button
                onClick={() => setShowRegenConfirm(true)}
                disabled={regeneratingMusic || (profile?.credits ?? 0) === 0}
                className="w-full flex items-center justify-center gap-2 border border-emerald text-emerald hover:bg-emerald hover:text-white font-bold py-3 rounded-2xl transition-all text-xs sm:text-sm disabled:opacity-50 cursor-pointer active:scale-[0.97]"
              >
                <RefreshCw size={16} /> Régénérer une autre version (1 crédit)
              </button>
            </div>
          )}
        </div>

        {/* COLONNE DROITE : PAROLES */}
        <div className="lg:col-span-7 flex flex-col h-full">
          {song.lyrics ? (
            <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-sm flex flex-col h-full animate-slideUp" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
              <div className="flex items-center justify-between border-b border-line pb-3 sm:pb-4 mb-4 flex-shrink-0 flex-wrap gap-2">
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

              <div className="bg-cream rounded-2xl p-4 sm:p-6 border border-line/60 overflow-y-auto flex-1 max-h-[400px] sm:max-h-[460px] lg:max-h-[520px]">
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
            <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-8 text-center text-muted text-sm flex-1 flex items-center justify-center">
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
    </div>
  );
}
