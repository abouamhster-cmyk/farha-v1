import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { callFunction } from "../lib/supabaseClient.js";
import Header from "../components/Header.jsx";
import { Play, Pause, Music, Loader2, Sparkles, ArrowRight, Heart, Gift, User } from "lucide-react";

const STYLE_LABEL = {
  chaabi: "Chaâbi", rai: "Raï", rap: "Rap / Trap", pop: "Pop orientale",
  acoustique: "Acoustique", gnawa: "Gnawa", oriental: "Orientale classique",
};

export default function PublicSong() {
  const { songId } = useParams();
  const [searchParams] = useSearchParams();
  const shareId = searchParams.get("s");

  const [song, setSong] = useState(null);
  const [share, setShare] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [revealed, setRevealed] = useState(!shareId);

  useEffect(() => {
    callFunction("get-public-song", { songId }, "GET")
      .then(({ song }) => setSong(song))
      .catch(() => setNotFound(true));
  }, [songId]);

  useEffect(() => {
    if (!shareId) return;
    callFunction("get-share-data", { shareId }, "GET")
      .then(({ share }) => setShare(share))
      .catch(() => {});
  }, [shareId]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {}
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
          <Music size={40} className="text-muted mb-4" />
          <h1 className="font-display text-2xl font-bold text-ink mb-2">Chanson introuvable</h1>
          <p className="text-muted mb-6">Ce lien n'existe plus, ou la création n'est pas encore prête.</p>
          <Link to="/" className="bg-henne hover:bg-henne-light text-white font-bold px-6 py-3 rounded-xl">
            Découvrir Farha Studio
          </Link>
        </div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="text-safran animate-spin" />
        </div>
      </div>
    );
  }

  const isPersonalized = share?.shareType === "personalized" && share?.senderName;
  const styleLabel = STYLE_LABEL[song.musicStyle] ?? song.musicStyle;

  if (isPersonalized && !revealed) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Header />
        <div className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center justify-center text-center">
          <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-line w-full space-y-6 animate-slideUp">
            {share.photoUrl ? (
              <div className="w-24 h-24 rounded-full mx-auto overflow-hidden border-4 border-safran/30 shadow-lg">
                <img src={share.photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto bg-safran/15 flex items-center justify-center border-4 border-safran/20">
                <Gift size={32} className="text-safran" />
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-safran flex items-center justify-center gap-1.5">
                <Sparkles size={12} /> Une surprise pour vous
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-snug">
                {share.senderName} vous a dédié une chanson
              </h1>
              {share.message && (
                <div className="bg-cream rounded-2xl p-4 border border-line mt-4">
                  <p className="text-sm text-muted italic leading-relaxed">
                    "{share.message}"
                  </p>
                  <p className="text-xs font-bold text-safran mt-2 flex items-center justify-end gap-1">
                    <Heart size={11} /> {share.senderName}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => setRevealed(true)}
              className="w-full flex items-center justify-center gap-2.5 bg-henne hover:bg-henne-light text-white font-bold py-4 rounded-2xl shadow-lg transition-all cursor-pointer text-base active:scale-[0.98]"
            >
              <Play size={18} fill="currentColor" className="ml-0.5" />
              Découvrir la chanson
            </button>

            <p className="text-[0.65rem] text-muted">
              Créé avec <span className="font-bold text-safran">Farha</span> — Le Studio de Haute Création Musicale
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Header />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16">

        {isPersonalized && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 mb-5 border border-safran/20 shadow-sm flex items-center gap-3 animate-slideUp">
            {share.photoUrl ? (
              <img src={share.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-safran/30 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-safran/15 flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-safran" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink">
                {share.senderName} vous a dédié cette chanson
              </p>
              {share.message && (
                <p className="text-xs text-muted italic mt-0.5 line-clamp-2">"{share.message}"</p>
              )}
            </div>
            <Heart size={16} className="text-henne flex-shrink-0" />
          </div>
        )}

        <div className="relative rounded-3xl overflow-hidden shadow-xl border border-white/15 text-white bg-[#0C0F0E]">
          {song.coverUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center blur-2xl scale-125 opacity-30 pointer-events-none"
              style={{ backgroundImage: `url('${song.coverUrl}')` }}
            />
          )}
          <div className="absolute inset-0 bg-[#0C0F0E]/85 backdrop-blur-xl pointer-events-none" />

          <div className="relative z-10 p-6 sm:p-10 space-y-6">
            {song.previewUrl && (
              <audio
                ref={audioRef}
                src={song.previewUrl}
                onEnded={() => setIsPlaying(false)}
              />
            )}

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border border-white/20">
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt="Pochette d'album" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald via-[#0C0F0E] to-henne flex items-center justify-center">
                    <Music size={30} className="text-white/40" />
                  </div>
                )}
              </div>

              <div className="flex-1 w-full text-center sm:text-left space-y-2">
                <div className="text-[0.68rem] font-bold uppercase tracking-widest text-safran flex items-center justify-center sm:justify-start gap-1.5">
                  <Sparkles size={12} /> Farha
                </div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
                  {isPersonalized
                    ? `Chanson dédiée par ${share.senderName}`
                    : song.recipientName
                      ? `Chanson pour ${song.recipientName}`
                      : "Chanson"
                  }
                </h1>
                <p className="text-sm text-white/60">
                  {song.occasion || "Projet spécial"} · <span className="capitalize">{styleLabel}</span>
                </p>
              </div>
            </div>

            {song.previewUrl && (
              <button
                onClick={togglePlay}
                className="w-full flex items-center justify-center gap-2.5 bg-safran hover:bg-safran-bright text-ink font-bold py-3.5 rounded-xl transition-all shadow-lg cursor-pointer"
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                {isPlaying ? "Lecture en cours..." : "Écouter l'extrait (30s)"}
              </button>
            )}
          </div>
        </div>

        {song.lyrics && (
          <div className="bg-white border border-line rounded-3xl p-6 sm:p-8 mt-6 shadow-sm">
            <h2 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
              <Music size={18} className="text-safran" /> Paroles de la chanson
            </h2>
            <div className="bg-cream rounded-2xl p-5 sm:p-6">
              <p className="font-arabic text-right text-lg leading-loose whitespace-pre-wrap" dir="rtl">
                {song.lyrics}
              </p>
            </div>
          </div>
        )}

        <div className="text-center mt-8 space-y-3">
          <p className="text-muted text-sm">
            {isPersonalized
              ? "Envie de créer une chanson personnalisée pour vos proches ?"
              : "Envie d'une création comme celle-ci pour vos propres projets ?"
            }
          </p>
          <Link
            to="/inscription"
            className="inline-flex items-center gap-2 bg-henne hover:bg-henne-light text-white font-bold px-7 py-3.5 rounded-xl shadow-md transition-all"
          >
            Lancer ma première création gratuite <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-muted/70">Paroles 100% gratuites · payez uniquement pour débloquer le projet final</p>
        </div>
      </div>
    </div>
  );
}
