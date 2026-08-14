import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase, callFunction } from "../lib/supabaseClient.js";
import { saveDraft, loadDraft, clearDraft } from "../lib/songCache.js";
import ProgressCircle from "../components/ProgressCircle.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import {
  ArrowRight, Loader2, RefreshCw, Check, Music, User,
  Globe, ChevronLeft, AlertTriangle, Save, Wifi, WifiOff, Sparkles, Video, Store, Laugh, PartyPopper, Lightbulb, Mic, Mic2, Users, Baby, CheckCircle2, ChevronDown, FileText, Headphones, History, RotateCcw
} from "lucide-react";

// Etape maximale atteignable pour une chanson donnee, deduite de son etat.
// 1 = idee, 2 = paroles, 3 = musique. On peut TOUJOURS revenir a une
// etape <= maxStep, mais jamais sauter en avant une etape non atteinte.
function computeMaxStep(song) {
  if (!song) return 1;
  const hasMusic = ["music_generating", "preview_ready", "purchased", "completed"].includes(song.status);
  if (hasMusic) return 3;
  if (song.lyrics || song.status === "lyrics_ready") return 2;
  return 1;
}

const DIALECTS = [
  { value: "marocain", label: "Darija marocaine (المغربية)" },
  { value: "algerien", label: "Darija algérienne (الجزائرية)" },
  { value: "tunisien", label: "Darija tunisienne (التونسية)" },
  { value: "libyen", label: "Lahja libyenne (الليبية)" },
  { value: "mauritaniene", label: "Hassanya mauritanienne (الحسانية)" },
  { value: "egyptien", label: "Égyptien (المصرية - Masri)" },
  { value: "levantin", label: "Levantin / Shami (الشامية)" },
  { value: "khaleeji", label: "Golfe / Khaleeji (الخليجية)" },
  { value: "fusha", label: "Arabe Poétique / Fusha (الفصحى)" },
];

const STYLES = [
  { value: "chaabi", label: "Chaâbi Festif" },
  { value: "rai", label: "Raï Moderne / Club" },
  { value: "rap", label: "Rap & Trap Darija" },
  { value: "pop", label: "Pop Orientale" },
  { value: "acoustique", label: "Acoustique / Chill" },
  { value: "gnawa", label: "Gnawa Fusion" },
  { value: "oriental", label: "Orientale / Andalou" },
  { value: "mezwed", label: "Mezwed Pop" },
  { value: "rnb", label: "R&B / Afrobeat" },
];

const VOICES = [
  { value: "homme", label: "Homme (solo)", Icon: Mic },
  { value: "femme", label: "Femme (solo)", Icon: Mic },
  { value: "duo", label: "Duo Homme/Femme", Icon: Users },
  { value: "choeurs", label: "Chœurs & Groupe", Icon: Users },
  { value: "enfant", label: "Voix d'enfant", Icon: Baby },
];

const CATEGORIES = [
  { id: "TikTok / Reels", label: "TikTok & Reels", Icon: Video, desc: "Sons viraux & Vlogs" },
  { id: "Pub / Business", label: "Pub & Commerce", Icon: Store, desc: "Jingles & marques" },
  { id: "Humour / Parodie", label: "Humour & Memes", Icon: Laugh, desc: "Blagues & parodies" },
  { id: "Mariage / Fête", label: "Mariage & Fêtes", Icon: PartyPopper, desc: "Célébrations" },
];

const TRANSLATION_LANGS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "tr", label: "Türkçe" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "it", label: "Italiano" },
  { value: "nl", label: "Nederlands" },
];

const EXPLICIT_PROMPT_TEMPLATES = [
  {
    label: "Vlog Voyage Marrakech",
    category: "TikTok / Reels",
    style: "rai",
    dialect: "marocain",
    voice: "homme",
    recipient: "Vlog Marrakech",
    text: "Musique ensoleillée et rythmée pour un vlog de voyage à Marrakech. Parler des ruelles de la Médina, du thé à la menthe, du soleil et des fous rires entre amis.",
  },
  {
    label: "Pub Marque Vêtements 'Atlas Wear'",
    category: "Pub / Business",
    style: "pop",
    dialect: "marocain",
    voice: "femme",
    recipient: "Marque 'Atlas Wear'",
    text: "Jingle commercial moderne et stylé pour la marque 'Atlas Wear'. Mettre en avant la nouvelle collection d'été, le style unique, la qualité et la livraison rapide.",
  },
  {
    label: "Le Pote Retardataire",
    category: "Humour / Parodie",
    style: "rap",
    dialect: "marocain",
    voice: "homme",
    recipient: "Youssef",
    text: "Chanson parodique et drôle sur mon meilleur ami Youssef qui arrive toujours 1 heure en retard avec son verre de café à la main et ses excuses bidons.",
  },
  {
    label: "Mariage (Dkhla العروسة)",
    category: "Mariage / Fête",
    style: "chaabi",
    dialect: "marocain",
    voice: "choeurs",
    recipient: "Reda & Sara",
    text: "Chanson festive et majestueuse en chaâbi pour l'entrée des mariés Reda et Sara. Célébrer leur amour, la beauté de la mariée, la joie des familles et faire danser les invités.",
  },
  {
    label: "Anniversaire 60 ans Maman",
    category: "Mariage / Fête",
    style: "chaabi",
    dialect: "marocain",
    voice: "femme",
    recipient: "Maman Fatima",
    text: "Chanson très émouvante et joyeuse pour les 60 ans de Maman Fatima. La remercier pour ses sacrifices, sa cuisine incroyable et lui souhaiter longue vie et santé.",
  },
  {
    label: "Pub Café / Restaurant 'Al Medina'",
    category: "Pub / Business",
    style: "gnawa",
    dialect: "marocain",
    voice: "homme",
    recipient: "Café Al Medina",
    text: "Chanson d'ambiance chaleureuse pour promouvoir le café 'Al Medina'. Parler des petits-déjeuners gourmands, du bon café, du tajine du midi et de l'accueil familial.",
  },
  {
    label: "Match de Foot entre Potes",
    category: "Humour / Parodie",
    style: "rai",
    dialect: "algerien",
    voice: "duo",
    recipient: "L'équipe du dimanche",
    text: "Chanson humoristique en raï sur nos matchs de foot du dimanche. Parler des ratés devant le but, des discussions passionnées et du thé d'après-match.",
  },
  {
    label: "Naissance Bébé Sofia",
    category: "Mariage / Fête",
    style: "acoustique",
    dialect: "tunisien",
    voice: "femme",
    recipient: "Bébé Sofia",
    text: "Berceuse douce et joyeuse pour la naissance de la petite Sofia. Souhaiter la bienvenue au bébé, féliciter les jeunes parents et célébrer ce bonheur.",
  },
  {
    label: "Réussite au Diplôme / Master",
    category: "Mariage / Fête",
    style: "rai",
    dialect: "algerien",
    voice: "homme",
    recipient: "Yassine",
    text: "Chanson de fierté et de fête en raï pour la réussite au Master de Yassine. Saluer ses efforts, ses nuits de révision et faire la fête en famille.",
  },
  {
    label: "Pub Produit Cosmétique 'Argan Glow'",
    category: "Pub / Business",
    style: "pop",
    dialect: "marocain",
    voice: "femme",
    recipient: "Marque 'Argan Glow'",
    text: "Son pop doux et élégant pour une marque de produits de beauté naturels à l'huile d'argan. Mettre en avant l'éclat de la peau et le bien-être.",
  },
  {
    label: "Storytime Tendance TikTok",
    category: "TikTok / Reels",
    style: "rap",
    dialect: "marocain",
    voice: "homme",
    recipient: "Storytime TikTok",
    text: "Son dynamique pour une vidéo TikTok storytime. Raconter une journée mouvementée au travail avec de l'humour et de l'énergie en darija.",
  },
  {
    label: "Roadtrip Vacances",
    category: "TikTok / Reels",
    style: "rai",
    dialect: "algerien",
    voice: "duo",
    recipient: "Roadtrip Été",
    text: "Chanson feel-good en raï moderne pour une vidéo de roadtrip le long de la côte. Ambiance été, liberté et soleil.",
  }
];

const TRANSLATE_DEBOUNCE_MS = 1200;

const STEP_ICONS = [FileText, Music, Headphones];
const STEP_LABELS = ["L'idée", "Paroles", "Musique"];

export default function CreateSong() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loadSongId = searchParams.get("song");
  const requestedStep = parseInt(searchParams.get("step") || "", 10);

  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [songId, setSongId] = useState(null);
  const [songHasMusic, setSongHasMusic] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSong, setLoadingSong] = useState(!!loadSongId);
  const [regeneratingLyrics, setRegeneratingLyrics] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [translating, setTranslating] = useState(false);
  const [templateAppliedNotice, setTemplateAppliedNotice] = useState("");
  const [lyricsHistory, setLyricsHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showRecomposeConfirm, setShowRecomposeConfirm] = useState(false);
  const [creatingVariant, setCreatingVariant] = useState(false);
  const translateTimer = useRef(null);
  const translateAbort = useRef(null);

  const [form, setForm] = useState({
    dialect: "marocain",
    music_style: "chaabi",
    voice_type: "homme",
    recipient_name: "",
    occasion: "TikTok / Reels",
    brief: "",
  });

  const [lyrics, setLyrics] = useState("");
  const [lyricsFr, setLyricsFr] = useState("");
  const [translatedLyrics, setTranslatedLyrics] = useState("");
  const [translationLang, setTranslationLang] = useState("fr");
  const [lyricsVersion, setLyricsVersion] = useState(0);
  const [activeTab, setActiveTab] = useState("darija");

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Chargement d'une chanson existante (reprise de brouillon, ou retour
  // depuis la page musique pour modifier paroles/idee). Prioritaire sur
  // le brouillon localStorage.
  useEffect(() => {
    if (!loadSongId) return;
    let cancelled = false;
    (async () => {
      const { data, error: loadErr } = await supabase
        .from("songs")
        .select("*")
        .eq("id", loadSongId)
        .single();
      if (cancelled) return;
      if (loadErr || !data) {
        setError("Chanson introuvable.");
        setLoadingSong(false);
        return;
      }
      setSongId(data.id);
      setForm({
        dialect: data.dialect,
        music_style: data.music_style,
        voice_type: data.voice_type || "homme",
        recipient_name: data.recipient_name || "",
        occasion: data.occasion || "TikTok / Reels",
        brief: data.brief || "",
      });
      setLyrics(data.lyrics || "");
      setLyricsFr(data.lyrics_fr || "");
      setTranslatedLyrics(data.lyrics_fr || "");
      setLyricsVersion(data.lyrics_version || 0);
      setLyricsHistory(Array.isArray(data.lyrics_history) ? data.lyrics_history : []);

      const reachable = computeMaxStep(data);
      setMaxStep(reachable);
      setSongHasMusic(reachable === 3);

      // Etape de depart : celle demandee (?step=) si atteignable, sinon
      // l'etape la plus avancee possible sans depasser la musique.
      let startStep = 1;
      if (requestedStep >= 1 && requestedStep <= reachable) startStep = requestedStep;
      else startStep = Math.min(reachable, 2); // par defaut on ouvre sur les paroles si dispo
      setStep(startStep);
      setLoadingSong(false);
    })();
    return () => { cancelled = true; };
  }, [loadSongId]);

  useEffect(() => {
    if (loadSongId) return; // pas de restauration localStorage si on ouvre une chanson precise
    const draft = loadDraft();
    if (draft) {
      if (draft.form) setForm(draft.form);
      if (draft.songId) setSongId(draft.songId);
      if (draft.lyrics) setLyrics(draft.lyrics);
      if (draft.lyricsFr) { setLyricsFr(draft.lyricsFr); setTranslatedLyrics(draft.lyricsFr); }
      if (draft.lyricsVersion) setLyricsVersion(draft.lyricsVersion);
      if (draft.step) { setStep(draft.step); setMaxStep(Math.max(draft.step, draft.lyrics ? 2 : 1)); }
      if (draft.lyrics) setMaxStep((m) => Math.max(m, 2));
      if (draft.activeTab) setActiveTab(draft.activeTab);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 4000);
    }
  }, [loadSongId]);

  useEffect(() => {
    saveDraft({ form, songId, lyrics, lyricsFr, lyricsVersion, step, activeTab });
  }, [form, songId, lyrics, lyricsFr, lyricsVersion, step, activeTab]);

  const applyTemplate = (tmpl) => {
    setForm({
      brief: tmpl.text,
      occasion: tmpl.category || form.occasion,
      music_style: tmpl.style || form.music_style,
      dialect: tmpl.dialect || form.dialect,
      voice_type: tmpl.voice || form.voice_type,
      recipient_name: tmpl.recipient || form.recipient_name,
    });
    setTemplateAppliedNotice(`Modèle "${tmpl.label}" appliqué avec succès !`);
    setTimeout(() => setTemplateAppliedNotice(""), 3500);
  };

  const translateLyrics = useCallback(async (source, text, dialect, targetLang) => {
    if (translateAbort.current) translateAbort.current.abort();
    const controller = new AbortController();
    translateAbort.current = controller;

    const langLabel = TRANSLATION_LANGS.find(l => l.value === targetLang)?.label || targetLang;
    const dialectLabel = DIALECTS.find(d => d.value === dialect)?.label || "darija";

    setTranslating(true);
    try {
      const direction = source === "darija"
        ? `Traduis ces paroles de ${dialectLabel} vers le ${langLabel}. Garde le même nombre de lignes.`
        : `Traduis ces paroles du ${langLabel} vers la ${dialectLabel} (alphabet arabe). Garde le même nombre de lignes.`;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-lyrics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text, direction, dialect }),
          signal: controller.signal,
        }
      );
      if (!resp.ok) throw new Error("Traduction échouée");
      const json = await resp.json();
      if (json.translation) {
        if (source === "darija") {
          setTranslatedLyrics(json.translation);
          if (targetLang === "fr") setLyricsFr(json.translation);
        } else {
          setLyrics(json.translation);
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") console.warn("Translation error:", err);
    } finally {
      setTranslating(false);
    }
  }, []);

  function handleLyricsChange(source, value) {
    if (source === "darija") {
      setLyrics(value);
    } else {
      setTranslatedLyrics(value);
      if (translationLang === "fr") setLyricsFr(value);
    }

    if (translateTimer.current) clearTimeout(translateTimer.current);
    if (value.trim().length > 10) {
      translateTimer.current = setTimeout(() => {
        translateLyrics(source, value, form.dialect, translationLang);
      }, TRANSLATE_DEBOUNCE_MS);
    }
  }

  function handleTranslationLangChange(newLang) {
    setTranslationLang(newLang);
    setTranslatedLyrics("");
    if (lyrics.trim().length > 10) {
      if (translateTimer.current) clearTimeout(translateTimer.current);
      translateLyrics("darija", lyrics, form.dialect, newLang);
    }
  }

  useEffect(() => {
    return () => {
      if (translateTimer.current) clearTimeout(translateTimer.current);
      if (translateAbort.current) translateAbort.current.abort();
    };
  }, []);

  async function handleCreateDraft(e) {
    e.preventDefault();
    setError("");
    if (form.brief.trim().length < 8) {
      setError("Décrivez un peu ce que vous voulez comme chanson.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("songs")
      .insert({ user_id: user.id, ...form })
      .select()
      .single();
    setLoading(false);
    if (error) return setError(error.message);
    setSongId(data.id);
    setStep(2);
    await handleGenerateLyrics(data.id);
  }

  async function handleGoBackAndResubmit() {
    setStep(1);
  }

  async function handleResubmitIdea(e) {
    e.preventDefault();
    setError("");
    if (form.brief.trim().length < 8) {
      setError("Décrivez un peu ce que vous voulez comme chanson.");
      return;
    }
    setLoading(true);

    if (songId) {
      const { error: updateErr } = await supabase
        .from("songs")
        .update({ ...form, status: "draft" })
        .eq("id", songId);
      if (updateErr) { setLoading(false); return setError(updateErr.message); }
      setStep(2);
      await handleGenerateLyrics(songId);
    } else {
      const { data, error } = await supabase
        .from("songs")
        .insert({ user_id: user.id, ...form })
        .select()
        .single();
      setLoading(false);
      if (error) return setError(error.message);
      setSongId(data.id);
      setStep(2);
      await handleGenerateLyrics(data.id);
    }
  }

  async function handleGenerateLyrics(id) {
    setError("");
    const isRegen = !!(lyrics || lyricsFr);
    if (isRegen) setRegeneratingLyrics(true);
    else setLoading(true);

    try {
      const { song } = await callFunction("generate-lyrics", { songId: id ?? songId });
      setLyrics(song.lyrics ?? "");
      setLyricsFr(song.lyrics_fr ?? "");
      if (translationLang === "fr") setTranslatedLyrics(song.lyrics_fr ?? "");
      else if (song.lyrics) translateLyrics("darija", song.lyrics, form.dialect, translationLang);
      setLyricsVersion(song.lyrics_version);
      setLyricsHistory(Array.isArray(song.lyrics_history) ? song.lyrics_history : []);
      setMaxStep((m) => Math.max(m, 2));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRegeneratingLyrics(false);
    }
  }

  // Navigation libre entre les etapes deja atteintes. L'etape 3 (musique)
  // vit sur la page dediee de la chanson.
  function goToStep(target) {
    if (target > maxStep) return;
    setError("");
    if (target === 3) {
      if (songId) navigate(`/chanson/${songId}`);
      return;
    }
    setStep(target);
  }

  // Restaure une version precedente des paroles (gratuit, non destructif :
  // regenerer plus tard reempilera de toute facon l'historique).
  function restoreLyricsVersion(entry) {
    setLyrics(entry.lyrics || "");
    setLyricsFr(entry.lyrics_fr || "");
    setTranslatedLyrics(entry.lyrics_fr || "");
    setActiveTab("darija");
    setShowHistory(false);
  }

  function handleValidateLyrics() {
    // Si la chanson a deja une musique, recomposer coute 1 credit et
    // remplace la musique existante -> on confirme d'abord.
    if (songHasMusic) {
      setShowRecomposeConfirm(true);
      return;
    }
    doComposeMusic();
  }

  // Cree une nouvelle version (variante) a partir de la chanson courante,
  // en gardant l'originale intacte. Copie les paroles actuelles.
  async function handleCreateVariant() {
    if (!songId) return;
    setShowRecomposeConfirm(false);
    setError("");
    setCreatingVariant(true);
    try {
      const res = await callFunction("create-variant", { songId, copyLyrics: true });
      clearDraft();
      navigate(`/creer?song=${res.songId}&step=${res.startStep || 2}`);
    } catch (err) {
      setError(err.message || String(err));
      setCreatingVariant(false);
    }
  }

  async function doComposeMusic() {
    setShowRecomposeConfirm(false);
    setError("");
    setLoading(true);
    setComposing(true);
    const { error: saveErr } = await supabase
      .from("songs")
      .update({ lyrics, lyrics_fr: lyricsFr, lyrics_validated_at: new Date().toISOString() })
      .eq("id", songId);
    if (saveErr) { setLoading(false); setComposing(false); return setError(saveErr.message); }
    try {
      await callFunction("generate-music", { songId });
      await refreshProfile();
      clearDraft();
      navigate(`/chanson/${songId}`);
    } catch (err) {
      setError(err.message);
      setComposing(false);
    } finally {
      setLoading(false);
    }
  }

  const hasExistingLyrics = !!(lyrics || lyricsFr);

  if (loadingSong || creatingVariant) {
    return (
      <div className="px-4 py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 size={30} className="text-safran animate-spin" />
        <p className="text-sm font-semibold text-muted">
          {creatingVariant ? "Création de la nouvelle version…" : "Chargement de votre projet…"}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 lg:px-12 py-6 lg:py-10 max-w-5xl mx-auto">

      {!online && (
        <div className="bg-henne/10 text-henne rounded-2xl px-4 py-3 mb-5 text-xs sm:text-sm flex items-center gap-2 border border-henne/20 animate-slideDown">
          <WifiOff size={16} /> Connexion perdue. Données sauvegardées localement.
        </div>
      )}

      {draftRestored && (
        <div className="bg-emerald/10 text-emerald rounded-2xl px-4 py-3 mb-5 text-xs sm:text-sm flex items-center gap-2 border border-emerald/20 animate-slideDown">
          <Save size={16} /> Brouillon restauré automatiquement.
        </div>
      )}

      {/* Stepper cliquable : on peut revenir a toute etape deja atteinte */}
      <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-3 sm:p-5 mb-6 sm:mb-8 shadow-sm flex items-center justify-between">
        {STEP_LABELS.map((label, i) => {
          const StepIcon = STEP_ICONS[i];
          const target = i + 1;
          const done = step > target;
          const active = step === target;
          const reachable = target <= maxStep && !loading && !composing && !regeneratingLyrics;
          const clickable = reachable && !active;
          return (
            <div key={label} className="flex items-center gap-2 sm:gap-3 flex-1 justify-center">
              <button
                type="button"
                onClick={() => clickable && goToStep(target)}
                disabled={!clickable}
                title={clickable ? `Aller à : ${label}` : undefined}
                className={`flex items-center gap-2 sm:gap-3 rounded-full transition-all ${clickable ? "cursor-pointer hover:opacity-80 active:scale-95" : "cursor-default"}`}
              >
                <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all duration-300 ${
                  done ? "bg-emerald text-white" : active ? "bg-safran text-ink shadow-sm font-bold ring-2 ring-safran/30" : reachable ? "bg-emerald/15 text-emerald" : "bg-line text-muted"
                }`}>
                  {done ? <Check size={16} /> : <StepIcon size={16} />}
                </span>
                <span className={`text-xs sm:text-sm font-semibold hidden sm:inline transition-colors ${active ? "text-ink font-bold" : reachable ? "text-emerald" : "text-muted"}`}>{label}</span>
              </button>
              {i < 2 && <span className="hidden md:block w-8 lg:w-12 h-px bg-line ml-2 sm:ml-3" />}
            </div>
          );
        })}
      </div>

      {maxStep > 1 && (
        <p className="-mt-4 sm:-mt-6 mb-6 text-center text-[0.7rem] sm:text-xs text-muted flex items-center justify-center gap-1.5">
          <RotateCcw size={12} className="text-emerald" />
          Astuce : cliquez sur une étape déjà franchie pour y revenir et ajuster.
        </p>
      )}

      {error && (
        <div className="bg-henne/10 text-henne rounded-2xl px-4 py-3 sm:py-4 mb-6 text-xs sm:text-sm flex items-center justify-between gap-3 border border-henne/20 animate-slideDown">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
          <button onClick={() => setError("")} className="text-henne/60 hover:text-henne font-bold flex-shrink-0 cursor-pointer">✕</button>
        </div>
      )}

      {/* STEP 1 : BRIEF */}
      {step === 1 && (
        <form onSubmit={hasExistingLyrics ? handleResubmitIdea : handleCreateDraft} className="bg-white border border-line rounded-2xl sm:rounded-3xl p-5 sm:p-10 space-y-6 sm:space-y-7 shadow-sm animate-slideUp">

          <div className="flex items-start justify-between flex-wrap gap-4 border-b border-line pb-5">
            <div>
              <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold">
                {hasExistingLyrics ? "Modifier votre projet" : "Quelle est votre idée ?"}
              </h1>
              <p className="text-muted text-xs sm:text-sm mt-1">
                {hasExistingLyrics
                  ? "Modifiez vos paramètres puis validez pour régénérer de nouvelles paroles."
                  : "Choisissez l'objectif et donnez vos consignes au studio."}
              </p>
            </div>
          </div>

          {/* Suggestions de prompts */}
          <details className="bg-cream/80 border border-safran/30 rounded-2xl overflow-hidden group">
            <summary className="p-3 sm:p-4 font-bold text-xs sm:text-sm text-emerald cursor-pointer flex items-center justify-between list-none hover:bg-safran/10 transition-colors">
              <span className="flex items-center gap-2">
                <Lightbulb size={18} className="text-safran" />
                <span>Besoin d'inspiration ? Choisir une idée pré-remplie</span>
              </span>
              <span className="text-xs bg-white px-2 sm:px-3 py-1 rounded-full border border-line font-bold text-muted flex items-center gap-1">
                <span className="hidden sm:inline">Menu des idées</span> <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
              </span>
            </summary>

            <div className="p-4 border-t border-line bg-white space-y-3">
              <label className="block text-xs font-bold text-muted">
                Sélectionnez un modèle pour remplir automatiquement l'usage, le style et le message :
              </label>
              <select
                onChange={(e) => {
                  const selected = EXPLICIT_PROMPT_TEMPLATES.find(t => t.label === e.target.value);
                  if (selected) applyTemplate(selected);
                }}
                className="input-field text-xs sm:text-sm bg-cream/50 cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>-- Sélectionner une idée de musique / vidéo / pub --</option>
                {EXPLICIT_PROMPT_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.label} value={tmpl.label}>
                    {tmpl.label} ({tmpl.category})
                  </option>
                ))}
              </select>

              {templateAppliedNotice && (
                <div className="text-xs font-bold text-emerald flex items-center gap-1.5 bg-emerald/10 p-2.5 rounded-xl border border-emerald/20 animate-popIn">
                  <CheckCircle2 size={14} /> {templateAppliedNotice}
                </div>
              )}
            </div>
          </details>

          {/* 1. Usage Principal */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-3">1. Usage principal</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {CATEGORIES.map((cat) => {
                const active = form.occasion === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm({ ...form, occasion: cat.id })}
                    className={`p-3 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.97] ${
                      active ? "border-safran bg-safran/10 text-ink font-bold shadow-sm ring-2 ring-safran/30" : "border-line bg-white hover:border-safran/40 text-muted"
                    }`}
                  >
                    <cat.Icon size={20} className={active ? "text-safran mb-1.5" : "text-emerald mb-1.5"} />
                    <div className="text-xs sm:text-sm font-bold leading-tight">{cat.label}</div>
                    <div className="text-[0.65rem] sm:text-[0.7rem] opacity-70 mt-0.5">{cat.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 & 3. Dialecte et Style Musical */}
          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">2. Dialecte & Langue</label>
              <select className="input-field cursor-pointer font-medium" value={form.dialect} onChange={(e) => setForm({ ...form, dialect: e.target.value })}>
                {DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">3. Style musical</label>
              <select className="input-field cursor-pointer font-medium" value={form.music_style} onChange={(e) => setForm({ ...form, music_style: e.target.value })}>
                {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* 4. Type de voix */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-3">4. Type de voix souhaité</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {VOICES.map((v) => {
                const active = form.voice_type === v.value;
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setForm({ ...form, voice_type: v.value })}
                    className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-[0.97] ${
                      active ? "border-safran bg-safran/10 text-ink font-bold shadow-sm ring-2 ring-safran/30" : "border-line bg-white hover:border-safran/40 text-muted"
                    }`}
                  >
                    <v.Icon size={16} className={active ? "text-safran" : "text-emerald"} />
                    <span className="text-xs font-semibold">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Destinataire */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">5. Destinataire, marque ou prénom (optionnel)</label>
            <input className="input-field" value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} placeholder="Ex : Marque 'Atlas Wear', Yasmine, Mon pote Reda" />
          </div>

          {/* 6. Brief */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">6. Vos instructions & détails</label>
            <textarea
              className="input-field min-h-[120px] sm:min-h-[140px] text-sm sm:text-base leading-relaxed"
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              placeholder="Racontez l'histoire, le message, la blague ou les détails sur le produit à mettre en valeur dans la chanson..."
            />
          </div>

          {/* Bouton submit */}
          <button type="submit" disabled={loading || !online} className="w-full flex items-center justify-center gap-2 bg-henne hover:bg-henne-light text-white font-bold py-3.5 sm:py-4 rounded-2xl shadow-lg hover:shadow-henne/40 transition-all text-sm sm:text-base lg:text-lg disabled:opacity-50 cursor-pointer border border-white/10 active:scale-[0.98]">
            {loading
              ? <><Loader2 size={20} className="animate-spin" /> {hasExistingLyrics ? "Régénération..." : "Écriture des paroles..."}</>
              : <>{hasExistingLyrics ? "Régénérer les paroles" : "Écrire les paroles"} <ArrowRight size={18} /></>}
          </button>
        </form>
      )}

      {/* STEP 2 : PAROLES */}
      {step === 2 && (
        <div className="bg-white border border-line rounded-2xl sm:rounded-3xl p-5 sm:p-10 shadow-sm space-y-5 sm:space-y-6 animate-slideUp">

          <div className="flex items-center justify-between border-b border-line pb-4 flex-wrap gap-2">
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold">Vos paroles</h1>
              <p className="text-muted text-xs sm:text-sm">Relisez, modifiez, c'est gratuit.</p>
            </div>
            <button onClick={handleGoBackAndResubmit} className="text-xs font-semibold text-emerald hover:underline flex items-center gap-1 bg-cream px-3 py-2 rounded-xl border border-line cursor-pointer active:scale-[0.97]">
              <ChevronLeft size={14} /> Modifier l'idée
            </button>
          </div>

          {composing ? (
            <div className="py-10 sm:py-12">
              <ProgressCircle estimatedSeconds={35} active={composing} size={100} label="Composition en cours..." />
            </div>
          ) : loading && !lyrics ? (
            <div className="py-10 sm:py-12">
              <ProgressCircle estimatedSeconds={12} active={loading} size={90} label="Écriture des paroles..." />
            </div>
          ) : (
            <>
              {regeneratingLyrics ? (
                <div className="flex flex-col items-center justify-center gap-3 min-h-[280px] sm:min-h-[320px]">
                  <Loader2 size={28} className="text-emerald animate-spin" />
                  <p className="text-sm font-semibold text-ink">Régénération des paroles en cours...</p>
                </div>
              ) : (
                <>
                  <div className="flex border-b border-line items-center">
                    <button
                      onClick={() => setActiveTab("darija")}
                      className={`px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                        activeTab === "darija" ? "border-emerald text-emerald font-bold" : "border-transparent text-muted"
                      }`}
                    >
                      {DIALECTS.find(d => d.value === form.dialect)?.label || "Paroles"}
                    </button>
                    <div className={`flex items-center border-b-2 transition-colors ${activeTab === "translation" ? "border-emerald" : "border-transparent"}`}>
                      <button
                        onClick={() => setActiveTab("translation")}
                        className={`pl-4 sm:pl-5 pr-1 py-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                          activeTab === "translation" ? "text-emerald font-bold" : "text-muted"
                        }`}
                      >
                        Traduction
                      </button>
                      <select
                        value={translationLang}
                        onChange={(e) => { handleTranslationLangChange(e.target.value); setActiveTab("translation"); }}
                        className="py-2 pr-1 sm:pr-2 text-xs sm:text-sm font-semibold bg-transparent border-none outline-none cursor-pointer text-emerald"
                      >
                        {TRANSLATION_LANGS.map(l => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                    {translating && (
                      <span className="ml-auto text-xs text-muted flex items-center gap-1.5 pr-2">
                        <Loader2 size={12} className="animate-spin text-emerald" /> Traduction...
                      </span>
                    )}
                  </div>

                  {activeTab === "darija" ? (
                    <textarea
                      className="input-field min-h-[280px] sm:min-h-[320px] font-arabic text-right text-base sm:text-xl leading-loose"
                      dir="rtl"
                      value={lyrics}
                      onChange={(e) => handleLyricsChange("darija", e.target.value)}
                    />
                  ) : (
                    <textarea
                      className="input-field min-h-[280px] sm:min-h-[320px] text-sm sm:text-base leading-relaxed"
                      placeholder={translating ? "Traduction en cours..." : "La traduction apparaîtra ici..."}
                      value={translatedLyrics}
                      onChange={(e) => handleLyricsChange("translation", e.target.value)}
                    />
                  )}
                </>
              )}

              {/* Historique GRATUIT des paroles : revenir a une version precedente */}
              {lyricsHistory.length > 0 && !regeneratingLyrics && (
                <div className="border border-line rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs sm:text-sm font-bold text-emerald hover:bg-cream transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <History size={16} className="text-safran" />
                      Versions précédentes des paroles ({lyricsHistory.length})
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} />
                  </button>
                  {showHistory && (
                    <div className="border-t border-line divide-y divide-line max-h-64 overflow-y-auto">
                      {[...lyricsHistory].reverse().map((entry, idx) => {
                        const preview = (entry.lyrics || "").split("\n").filter((l) => l.trim()).slice(0, 2).join(" · ");
                        return (
                          <div key={idx} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cream/60 transition-colors">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-ink">Version {entry.version ?? "?"}</div>
                              <div className="text-[0.7rem] text-muted font-arabic text-right truncate" dir="rtl">{preview || "—"}</div>
                            </div>
                            <button
                              onClick={() => restoreLyricsVersion(entry)}
                              className="flex items-center gap-1.5 text-xs font-bold text-emerald bg-emerald/10 hover:bg-emerald/20 border border-emerald/20 px-3 py-1.5 rounded-xl transition-colors cursor-pointer flex-shrink-0 active:scale-[0.97]"
                            >
                              <RotateCcw size={12} /> Restaurer
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-3">
                <button
                  onClick={() => handleGenerateLyrics()}
                  disabled={loading || regeneratingLyrics}
                  className="flex-1 flex items-center justify-center gap-2 border border-emerald text-emerald hover:bg-emerald hover:text-white font-bold py-3 sm:py-3.5 rounded-xl transition-all text-sm disabled:opacity-50 cursor-pointer active:scale-[0.97]"
                >
                  {regeneratingLyrics
                    ? <><Loader2 size={16} className="animate-spin" /> Régénération...</>
                    : <><RefreshCw size={16} /> Régénérer d'autres paroles</>}
                </button>
                <button
                  onClick={handleValidateLyrics}
                  disabled={loading || regeneratingLyrics || !online}
                  className="flex-1 flex items-center justify-center gap-2 bg-henne hover:bg-henne-light text-white font-bold py-3 sm:py-3.5 rounded-xl shadow-md transition-all text-sm sm:text-base cursor-pointer active:scale-[0.98]"
                >
                  <Mic2 size={16} />
                  {songHasMusic ? "Recomposer la musique" : "Valider et Composer"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={showRecomposeConfirm}
        onCancel={() => setShowRecomposeConfirm(false)}
        onConfirm={doComposeMusic}
        title="Modifier cette chanson"
        confirmLabel="Remplacer (1 crédit)"
        confirmColor="bg-henne hover:bg-henne-light"
        primaryAction={{ label: "Créer une nouvelle version (garde l'originale)", onClick: handleCreateVariant, color: "bg-emerald hover:bg-emerald-light" }}
      >
        <p>Cette chanson a déjà une musique. Deux options :</p>
        <p className="mt-2"><strong className="text-emerald">Nouvelle version</strong> (recommandé) : crée une variante à partir de ces paroles et <strong>garde l'originale intacte</strong>. Vous composerez ensuite (1 crédit).</p>
        <p className="mt-2"><strong className="text-henne">Remplacer</strong> : recompose et <strong>écrase</strong> la musique actuelle. Consomme 1 crédit.</p>
      </ConfirmModal>
    </div>
  );
}
