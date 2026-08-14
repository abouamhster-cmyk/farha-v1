import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { callFunction } from "../lib/supabaseClient.js";
import { Play, Pause, Music, Loader2, Sparkles, ArrowRight, Heart, Gift } from "lucide-react";

const EQ_BARS = [0, 1, 2, 3, 4, 5, 6];

function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function PublicSong() {
  const { songId } = useParams();
  const [searchParams] = useSearchParams();
  const shareId = searchParams.get("s");

  const [song, setSong] = useState(null);
  const [share, setShare] = useState(null);
  const [shareResolved, setShareResolved] = useState(!shareId); // pas de partage => déjà résolu
  const [notFound, setNotFound] = useState(false);
  const [revealed, setRevealed] = useState(!shareId);

  const audioRef = useRef(null);
  const listenTracked = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    callFunction("get-public-song", { songId }, "GET")
      .then(({ song }) => setSong(song))
      .catch(() => setNotFound(true));
  }, [songId]);

  useEffect(() => {
    if (!shareId) return;
    callFunction("get-share-data", { shareId }, "GET")
      .then(({ share }) => setShare(share))
      .catch(() => {})
      .finally(() => setShareResolved(true));
  }, [shareId]);

  function trackListenOnce() {
    if (listenTracked.current) return;
    listenTracked.current = true;
    callFunction("track-share-listen", { shareId: shareId || null, songId }).catch(() => {});
  }

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        trackListenOnce();
      } catch { /* lecture bloquée */ }
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
    setDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration) audioRef.current.currentTime = pos * duration;
  };

  // ---- Écrans d'état (aucune barre du haut) ----

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0C0F0E] flex flex-col items-center justify-center text-center px-6 py-20 text-white">
        <Music size={40} className="text-white/40 mb-4" />
        <h1 className="font-display text-2xl font-bold mb-2">Chanson introuvable</h1>
        <p className="text-white/50 mb-6">Ce lien n'existe plus, ou la création n'est pas encore prête.</p>
        <Link to="/" className="bg-henne hover:bg-henne-light text-white font-bold px-6 py-3 rounded-xl transition-colors">
          Découvrir Farha Studio
        </Link>
      </div>
    );
  }

  // On attend d'avoir la chanson ET (si lien de partage) les données de
  // partage, pour ne jamais montrer la page brute avant la carte dédiée.
  if (!song || !shareResolved) {
    return (
      <div className="min-h-screen bg-[#0C0F0E] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-safran/30 blur-2xl animate-haloPulse" />
          <Loader2 size={34} className="relative text-safran animate-spin" />
        </div>
        <p className="text-white/40 text-xs font-semibold tracking-widest uppercase">Farha</p>
      </div>
    );
  }

  const isPersonalized = share?.shareType === "personalized" && share?.senderName;
  const coverImage = song.coverUrl;

  // ---- Carte de révélation cinématique (dédicace personnalisée) ----
  if (isPersonalized && !revealed) {
    return (
      <div className="min-h-screen bg-[#0C0F0E] relative overflow-hidden flex items-center justify-center px-4 py-10">
        {/* Fond ambiant */}
        {coverImage && (
          <div className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-25" style={{ backgroundImage: `url('${coverImage}')` }} />
        )}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-safran/20 rounded-full blur-3xl animate-haloPulse pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-henne/20 rounded-full blur-3xl animate-haloPulse pointer-events-none" style={{ animationDelay: "1.5s" }} />

        <div className="relative z-10 w-full max-w-md text-center animate-revealCard">
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[28px] p-8 sm:p-10 shadow-2xl space-y-6">
            {/* Photo / icône expéditeur avec halo doré */}
            <div className="relative w-28 h-28 mx-auto">
              <div className="absolute inset-0 rounded-full bg-safran/40 blur-xl animate-haloPulse" />
              {share.photoUrl ? (
                <img src={share.photoUrl} alt="" className="relative w-28 h-28 rounded-full object-cover border-[3px] border-safran/60 shadow-lg animate-floatY" />
              ) : (
                <div className="relative w-28 h-28 rounded-full bg-safran/15 border-[3px] border-safran/40 flex items-center justify-center animate-floatY">
                  <Gift size={38} className="text-safran" />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-safran flex items-center justify-center gap-1.5">
                <Sparkles size={12} /> Une surprise rien que pour vous
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug">
                {share.senderName} vous a dédié<br />une chanson
              </h1>
              {share.message && (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mt-2">
                  <p className="text-sm text-white/80 italic leading-relaxed">"{share.message}"</p>
                  <p className="text-xs font-bold text-safran mt-2 flex items-center justify-end gap-1">
                    <Heart size={11} fill="currentColor" /> {share.senderName}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setRevealed(true)}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-safran to-henne hover:opacity-95 text-white font-bold py-4 rounded-2xl shadow-[0_12px_30px_rgba(232,149,40,0.35)] transition-all cursor-pointer text-base active:scale-[0.98] animate-pulseGlow"
            >
              <Play size={18} fill="currentColor" className="ml-0.5" />
              Découvrir la chanson
            </button>

            <p className="text-[0.65rem] text-white/40">
              Créé avec <span className="font-bold text-safran">Farha</span> — Studio de Haute Création Musicale
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Lecteur immersif plein écran (musique complète) ----
  return (
    <div className="min-h-screen bg-[#0C0F0E] relative overflow-hidden flex flex-col items-center justify-center px-4 py-10 sm:py-14">
      {/* Ambiance : pochette floutée + halos */}
      {coverImage && (
        <div className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-30" style={{ backgroundImage: `url('${coverImage}')` }} />
      )}
      <div className="absolute inset-0 bg-[#0C0F0E]/80" />
      <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] bg-safran/15 rounded-full blur-3xl animate-haloPulse pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[28rem] h-[28rem] bg-emerald/20 rounded-full blur-3xl animate-haloPulse pointer-events-none" style={{ animationDelay: "1.2s" }} />

      <div className="relative z-10 w-full max-w-md text-center animate-revealCard">

        {/* Bandeau dédicace compacte (si personnalisé) */}
        {isPersonalized && (
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full pl-1.5 pr-4 py-1.5 mb-7 backdrop-blur-md">
            {share.photoUrl ? (
              <img src={share.photoUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-safran/50" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-safran/20 flex items-center justify-center"><Heart size={13} className="text-safran" fill="currentColor" /></span>
            )}
            <span className="text-xs text-white/80 font-semibold">Dédiée par {share.senderName}</span>
          </div>
        )}

        {/* Carte lecteur — glassmorphisme, profondeur */}
        <div className="relative rounded-[32px] p-6 sm:p-8 bg-white/[0.05] backdrop-blur-2xl border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden">
          {/* reflet supérieur subtil */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          {/* Badge qualité */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-safran bg-safran/10 border border-safran/25 px-3 py-1 rounded-full">
              <Sparkles size={11} /> {song.isFull ? "Chanson complète HD" : "Extrait"}
            </span>
          </div>

          {/* Pochette animée avec halo */}
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 mx-auto mb-6">
            <div className={`absolute -inset-4 rounded-[32px] bg-gradient-to-br from-safran/40 to-henne/40 blur-2xl ${isPlaying ? "animate-haloPulse" : "opacity-40"}`} />
            <div className={`relative w-full h-full rounded-[28px] overflow-hidden shadow-2xl border border-white/15 ${isPlaying ? "animate-floatY" : ""}`}>
              {coverImage ? (
                <img src={coverImage} alt="Pochette" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald via-[#0C0F0E] to-henne flex items-center justify-center">
                  <Music size={44} className="text-white/40" />
                </div>
              )}
            </div>
          </div>

          {/* Message dédié (description = ce que le sender a écrit) */}
          {isPersonalized && share.message && (
            <p className="text-center text-sm text-white/75 italic leading-relaxed mb-6 px-2">
              "{share.message}"
            </p>
          )}

          {/* Lecteur */}
          {song.audioUrl && (
            <audio
              ref={audioRef}
              src={song.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />
          )}

          {/* Barre de progression */}
          <div className="space-y-1.5 mb-6">
            <div onClick={handleSeek} className="w-full h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer border border-white/10">
              <div className="h-full bg-gradient-to-r from-safran to-safran-bright rounded-full" style={{ width: `${(currentTime / (duration || 1)) * 100}%`, transition: "width 0.1s linear" }} />
            </div>
            <div className="flex justify-between text-[0.65rem] text-white/40 font-semibold">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Bouton lecture + égaliseur */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-safran to-henne text-white flex items-center justify-center shadow-[0_12px_30px_rgba(232,149,40,0.4)] transition-transform active:scale-95 cursor-pointer flex-shrink-0"
            >
              {isPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
            </button>

            <div className="flex items-end gap-1 h-8">
              {EQ_BARS.map((i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full bg-safran/80 ${isPlaying ? "animate-equalize" : ""}`}
                  style={{ height: "100%", animationDelay: `${i * 0.12}s`, transform: isPlaying ? undefined : "scaleY(0.3)", transformOrigin: "bottom" }}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-white/50 mt-5 font-medium text-center">
            {isPlaying ? "Lecture en cours…" : song.isFull ? "Appuyez pour écouter la chanson complète" : "Appuyez pour écouter"}
          </p>
        </div>
      </div>

      {/* Note discrète en bas (remplace la barre du haut) */}
      <div className="relative z-10 mt-12 text-center space-y-2.5">
        <p className="text-white/40 text-xs">Créé avec <span className="font-bold text-safran">Farha</span> — Studio de Haute Création Musicale</p>
        <Link
          to="/inscription"
          className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-bold border border-white/15 hover:border-safran/50 bg-white/5 rounded-full px-4 py-2 transition-colors"
        >
          Créer ma chanson <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
