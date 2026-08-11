import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase, callFunction } from "../lib/supabaseClient.js";
import { saveDraft, loadDraft, clearDraft } from "../lib/songCache.js";
import ProgressCircle from "../components/ProgressCircle.jsx";
import {
  ArrowRight, Loader2, RefreshCw, Check, Music, User,
  Globe, ChevronLeft, AlertTriangle, Save, Wifi, WifiOff, Sparkles, Video, Store, Laugh, PartyPopper, Lightbulb, Mic, Users, Baby, CheckCircle2, ChevronDown
} from "lucide-react";

// --- LISTE COMPLÈTE DES 9 DIALECTES (MAGHREB + EGYPTE + MOYEN-ORIENT) ---
const DIALECTS = [
  // Maghreb
  { value: "marocain", label: "🇲🇦 Darija marocaine (المغربية)" },
  { value: "algerien", label: "🇩🇿 Darija algérienne (الجزائرية)" },
  { value: "tunisien", label: "🇹🇳 Darija tunisienne (التونسية)" },
  { value: "libyen", label: "🇱🇾 Lahja libyenne (الليبية)" },
  { value: "mauritaniene", label: "🇲🇷 Hassanya mauritanienne (الحسانية)" },
  
  // Égypte & Moyen-Orient
  { value: "egyptien", label: "🇪🇬 Égyptien (المصرية - Masri)" },
  { value: "levantin", label: "🇱🇧 Levantin / Shami (الشامية)" },
  { value: "khaleeji", label: "🇸🇦 Golfe / Khaleeji (الخليجية)" },

  // Arabe Littéraire / Poétique
  { value: "fusha", label: "📜 Arabe Poétique / Fusha (الفصحى)" },
];

const STYLES = [
  { value: "chaabi", label: "Chaâbi Festif" },
  { value: "rai", label: "Raï Moderne / Club" },
  { value: "rap", label: "Rap & Trap" },
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

// --- MODÈLES DE PROMPTS REPLIABLES ---
const EXPLICIT_PROMPT_TEMPLATES = [
  {
    label: "🎬 Vlog Voyage Marrakech",
    category: "TikTok / Reels",
    style: "rai",
    dialect: "marocain",
    voice: "homme",
    recipient: "Vlog Marrakech",
    text: "Musique ensoleillée et rythmée pour un vlog de voyage à Marrakech. Parler des ruelles de la Médina, du thé à la menthe, du soleil et des fous rires entre amis.",
  },
  {
    label: "🛍️ Pub Marque Vêtements 'Atlas Wear'",
    category: "Pub / Business",
    style: "pop",
    dialect: "marocain",
    voice: "femme",
    recipient: "Marque 'Atlas Wear'",
    text: "Jingle commercial moderne et stylé pour la marque 'Atlas Wear'. Mettre en avant la nouvelle collection d'été, le style unique, la qualité et la livraison rapide.",
  },
  {
    label: "🇪🇬 Pub Égyptienne Produit Beauté",
    category: "Pub / Business",
    style: "pop",
    dialect: "egyptien",
    voice: "femme",
    recipient: "Marque Beauty",
    text: "Chanson joyeuse et rythmée en dialecte égyptien Masri pour promouvoir des produits cosmétiques. Ton chaleureux et dynamique.",
  },
  {
    label: "😂 Le Pote Retardataire",
    category: "Humour / Parodie",
    style: "rap",
    dialect: "marocain",
    voice: "homme",
    recipient: "Youssef",
    text: "Chanson parodique et drôle sur mon meilleur ami Youssef qui arrive toujours 1 heure en retard avec son verre de café à la main et ses excuses bidons.",
  },
  {
    label: "👰 Mariage (Dkhla العروسة)",
    category: "Mariage / Fête",
    style: "chaabi",
    dialect: "marocain",
    voice: "choeurs",
    recipient: "Reda & Sara",
    text: "Chanson festive et majestueuse en chaâbi pour l'entrée des mariés Reda et Sara. Célébrer leur amour, la beauté de la mariée, la joie des familles et faire danser les invités.",
  },
  {
    label: "🎂 Anniversaire 60 ans Maman",
    category: "Mariage / Fête",
    style: "chaabi",
    dialect: "marocain",
    voice: "femme",
    recipient: "Maman Fatima",
    text: "Chanson très émouvante et joyeuse pour les 60 ans de Maman Fatima. La remercier pour ses sacrifices, sa cuisine incroyable et lui souhaiter longue vie et santé.",
  },
  {
    label: "☕ Pub Café / Restaurant 'Al Medina'",
    category: "Pub / Business",
    style: "gnawa",
    dialect: "marocain",
    voice: "homme",
    recipient: "Café Al Medina",
    text: "Chanson d'ambiance chaleureuse pour promouvoir le café 'Al Medina'. Parler des petits-déjeuners gourmands, du bon café, du tajine du midi et de l'accueil familial.",
  },
  {
    label: "⚽ Match de Foot entre Potes",
    category: "Humour / Parodie",
    style: "rai",
    dialect: "algerien",
    voice: "duo",
    recipient: "L'équipe du dimanche",
    text: "Chanson humoristique en raï sur nos matchs de foot du dimanche. Parler des ratés devant le but, des discussions passionnées et du thé d'après-match.",
  },
  {
    label: "👶 Naissance Bébé Sofia",
    category: "Mariage / Fête",
    style: "acoustique",
    dialect: "tunisien",
    voice: "femme",
    recipient: "Bébé Sofia",
    text: "Berceuse douce et joyeuse pour la naissance de la petite Sofia. Souhaiter la bienvenue au bébé, féliciter les jeunes parents et célébrer ce bonheur.",
  },
  {
    label: "🎓 Réussite au Diplôme / Master",
    category: "Mariage / Fête",
    style: "rai",
    dialect: "algerien",
    voice: "homme",
    recipient: "Yassine",
    text: "Chanson de fierté et de fête en raï pour la réussite au Master de Yassine. Saluer ses efforts, ses nuits de révision et faire la fête en famille.",
  },
  {
    label: "📱 Storytime Tendance TikTok",
    category: "TikTok / Reels",
    style: "rap",
    dialect: "marocain",
    voice: "homme",
    recipient: "Storytime TikTok",
    text: "Son dynamique pour une vidéo TikTok storytime. Raconter une journée mouvementée au travail avec de l'humour et de l'énergie.",
  },
  {
    label: "🚗 Roadtrip Vacances",
    category: "TikTok / Reels",
    style: "rai",
    dialect: "algerien",
    voice: "duo",
    recipient: "Roadtrip Été",
    text: "Chanson feel-good en raï moderne pour une vidéo de roadtrip le long de la côte. Ambiance été, liberté et soleil.",
  }
];

const TRANSLATE_DEBOUNCE_MS = 1200;

export default function CreateSong() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [songId, setSongId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [regeneratingLyrics, setRegeneratingLyrics] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [translating, setTranslating] = useState(false);
  const [templateAppliedNotice, setTemplateAppliedNotice] = useState("");

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

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (draft.form) setForm(draft.form);
      if (draft.songId) setSongId(draft.songId);
      if (draft.lyrics) setLyrics(draft.lyrics);
      if (draft.lyricsFr) setLyricsFr(draft.lyricsFr);
      if (draft.lyricsVersion) setLyricsVersion(draft.lyricsVersion);
      if (draft.step) setStep(draft.step);
      if (draft.activeTab) setActiveTab(draft.activeTab);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 4000);
    }
  }, []);

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

  const translateLyrics = useCallback(async (source, text, dialect) => {
    if (translateAbort.current) translateAbort.current.abort();
    const controller = new AbortController();
    translateAbort.current = controller;

    setTranslating(true);
    try {
      const dialectLabel = DIALECTS.find(d => d.value === dialect)?.label || "darija";
      const direction = source === "darija"
        ? `Traduis ces paroles de ${dialectLabel} vers le français. Garde le même nombre de lignes. Traduction fidèle ligne par ligne, pas d'explication.`
        : `Traduis ces paroles du français vers la ${dialectLabel} (alphabet arabe). Garde le même nombre de lignes. Traduction fidèle ligne par ligne, pas d'explication.`;

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
          setLyricsFr(json.translation);
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
      setLyricsFr(value);
    }
    if (translateTimer.current) clearTimeout(translateTimer.current);
    if (value.trim().length > 10) {
      translateTimer.current = setTimeout(() => {
        translateLyrics(source, value, form.dialect);
      }, TRANSLATE_DEBOUNCE_MS);
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
      setError("Donnez-nous au moins quelques mots d'explication pour votre chanson.");
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
      setError("Donnez-nous au moins quelques mots d'explication pour votre chanson.");
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
    if (isRegen) {
      setRegeneratingLyrics(true);
    } else {
      setLoading(true);
    }
    try {
      const { song } = await callFunction("generate-lyrics", { songId: id ?? songId });
      setLyrics(song.lyrics ?? "");
      setLyricsFr(song.lyrics_fr ?? "");
      setLyricsVersion(song.lyrics_version);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRegeneratingLyrics(false);
    }
  }

  async function handleValidateLyrics() {
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

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-6 lg:py-10 max-w-5xl mx-auto">

      {!online && (
        <div className="bg-henne/10 text-henne rounded-2xl px-5 py-3 mb-5 text-xs sm:text-sm flex items-center gap-2 border border-henne/20">
          <WifiOff size={16} /> Connexion perdue. Données sauvegardées localement.
        </div>
      )}

      {draftRestored && (
        <div className="bg-emerald/10 text-emerald rounded-2xl px-5 py-3 mb-5 text-xs sm:text-sm flex items-center gap-2 border border-emerald/20">
          <Save size={16} /> Brouillon restauré automatiquement.
        </div>
      )}

      {/* Stepper Propre & Aéré */}
      <div className="bg-white border border-line rounded-3xl p-5 mb-8 shadow-sm flex items-center justify-between">
        {["1. L'idée & Le Style", "2. Les Paroles", "3. La Musique"].map((label, i) => (
          <div key={label} className="flex items-center gap-3 flex-1 justify-center">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              step > i + 1 ? "bg-emerald text-white" : step === i + 1 ? "bg-safran text-ink shadow-sm font-bold" : "bg-line text-muted"
            }`}>
              {step > i + 1 ? <Check size={16} /> : i + 1}
            </span>
            <span className={`text-xs sm:text-sm font-semibold hidden sm:inline ${step === i + 1 ? "text-ink font-bold" : "text-muted"}`}>{label}</span>
            {i < 2 && <span className="hidden md:block w-12 h-px bg-line ml-3" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-henne/10 text-henne rounded-2xl px-5 py-4 mb-6 text-xs sm:text-sm flex items-start gap-3 border border-henne/20">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* STEP 1 : BRIEF */}
      {step === 1 && (
        <form onSubmit={hasExistingLyrics ? handleResubmitIdea : handleCreateDraft} className="bg-white border border-line rounded-3xl p-6 sm:p-10 space-y-7 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-4 border-b border-line pb-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-safran/10 text-safran border border-safran/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles size={12} /> Studio de Haute Création
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                {hasExistingLyrics ? "Modifier votre projet" : "Quelle est votre idée ?"}
              </h1>
              <p className="text-muted text-xs sm:text-sm mt-1">
                {hasExistingLyrics
                  ? "Modifiez vos paramètres puis validez pour régénérer de nouvelles paroles."
                  : "Choisissez l'objectif et donnez vos consignes au studio."}
              </p>
            </div>
          </div>

          {/* SUGGESTIONS DE PROMPTS COMPACTES ET REPLIABLES (EN HAUT DU FORMULAIRE) */}
          <details className="bg-cream/80 border border-line rounded-2xl overflow-hidden group">
            <summary className="p-3.5 sm:p-4 font-bold text-xs sm:text-sm text-emerald cursor-pointer flex items-center justify-between list-none hover:bg-safran/10 transition-colors">
              <span className="flex items-center gap-2">
                <Lightbulb size={18} className="text-safran" />
                <span>Besoin d'inspiration ? Choisir une idée pré-remplie</span>
              </span>
              <span className="text-xs bg-white px-3 py-1 rounded-full border border-line font-bold text-muted flex items-center gap-1">
                Menu des idées <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
              </span>
            </summary>

            <div className="p-4 border-t border-line bg-white space-y-3">
              <label className="block text-xs font-bold text-muted">
                Sélectionnez un modèle pour remplir automatiquement l'usage, le style, le dialecte et le message :
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
                <div className="text-xs font-bold text-emerald flex items-center gap-1.5 bg-emerald/10 p-2.5 rounded-xl border border-emerald/20">
                  <CheckCircle2 size={14} /> {templateAppliedNotice}
                </div>
              )}
            </div>
          </details>

          {/* 1. Usage Principal (Catégories) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-3">1. Usage principal</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {CATEGORIES.map((cat) => {
                const active = form.occasion === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setForm({ ...form, occasion: cat.id })}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      active ? "border-safran bg-safran/10 text-ink font-bold shadow-sm ring-2 ring-safran/30" : "border-line bg-white hover:border-emerald/40 text-muted"
                    }`}
                  >
                    <cat.Icon size={22} className={active ? "text-safran mb-2" : "text-emerald mb-2"} />
                    <div className="text-xs sm:text-sm font-bold leading-tight">{cat.label}</div>
                    <div className="text-[0.7rem] opacity-70 mt-1">{cat.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 & 3. Dialecte et Style Musical */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">2. Dialecte & Langue</label>
              <select className="input-field" value={form.dialect} onChange={(e) => setForm({ ...form, dialect: e.target.value })}>
                {DIALECTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">3. Style musical</label>
              <select className="input-field" value={form.music_style} onChange={(e) => setForm({ ...form, music_style: e.target.value })}>
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
                    className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 ${
                      active ? "border-safran bg-safran/10 text-ink font-bold shadow-sm ring-2 ring-safran/30" : "border-line bg-white hover:border-emerald/40 text-muted"
                    }`}
                  >
                    <v.Icon size={16} className={active ? "text-safran" : "text-emerald"} />
                    <span className="text-xs font-semibold">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Destinataire ou Marque */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">5. Destinataire, marque ou prénom (optionnel)</label>
            <input className="input-field" value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} placeholder="Ex : Marque 'Atlas Wear', Yasmine, Mon pote Reda" />
          </div>

          {/* 6. Brief / Instructions */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">6. Vos instructions & détails</label>
            <textarea
              className="input-field min-h-[140px] text-sm sm:text-base leading-relaxed"
              value={form.brief}
              onChange={(e) => setForm({ ...form, brief: e.target.value })}
              placeholder="Racontez l'histoire, le message, la blague ou les détails sur le produit à mettre en valeur dans la chanson..."
            />
          </div>

          <button type="submit" disabled={loading || !online} className="w-full flex items-center justify-center gap-2 bg-henne hover:bg-henne-light text-white font-bold py-4 rounded-2xl shadow-md transition-all text-base sm:text-lg disabled:opacity-50 cursor-pointer">
            {loading
              ? <><Loader2 size={20} className="animate-spin" /> {hasExistingLyrics ? "Régénération des paroles..." : "Rédaction des paroles par le studio..."}</>
              : <>{hasExistingLyrics ? "Régénérer les paroles avec cette idée" : "Générer les paroles gratuites"} <ArrowRight size={18} /></>}
          </button>
        </form>
      )}

      {/* STEP 2 : PAROLES */}
      {step === 2 && (
        <div className="bg-white border border-line rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4 flex-wrap gap-2">
            <div>
              <h1 className="font-display text-2xl font-bold">Vos paroles sur-mesure</h1>
              <p className="text-muted text-xs sm:text-sm">Relisez et modifiez librement. C'est 100% gratuit.</p>
            </div>
            <button onClick={handleGoBackAndResubmit} className="text-xs font-semibold text-emerald hover:underline flex items-center gap-1 bg-cream px-3.5 py-2 rounded-xl border border-line">
              <ChevronLeft size={14} /> Modifier l'idée
            </button>
          </div>

          {composing ? (
            <div className="py-12">
              <ProgressCircle estimatedSeconds={35} active={composing} size={100} label="Le studio compose et chante votre morceau..." />
            </div>
          ) : loading && !lyrics ? (
            <div className="py-12">
              <ProgressCircle estimatedSeconds={12} active={loading} size={90} label="Rédaction des paroles authentiques..." />
            </div>
          ) : (
            <>
              {/* Overlay de régénération */}
              {regeneratingLyrics && (
                <div className="relative">
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[200px]">
                    <Loader2 size={28} className="text-emerald animate-spin" />
                    <p className="text-sm font-semibold text-ink">Régénération des paroles en cours...</p>
                    <p className="text-xs text-muted">Les nouvelles paroles vont remplacer les actuelles</p>
                  </div>
                </div>
              )}

              {/* Onglets Darija / FR */}
              <div className="flex border-b border-line items-center">
                <button
                  onClick={() => setActiveTab("darija")}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === "darija" ? "border-emerald text-emerald font-bold" : "border-transparent text-muted"
                  }`}
                >
                  Version Principale (Arabe)
                </button>
                <button
                  onClick={() => setActiveTab("french")}
                  className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === "french" ? "border-emerald text-emerald font-bold" : "border-transparent text-muted"
                  }`}
                >
                  Traduction Française
                </button>
                {translating && (
                  <span className="ml-auto text-xs text-muted flex items-center gap-1.5 pr-2">
                    <Loader2 size={12} className="animate-spin text-emerald" /> Traduction auto...
                  </span>
                )}
              </div>

              {activeTab === "darija" ? (
                <textarea
                  className="input-field min-h-[320px] font-arabic text-right text-base sm:text-xl leading-loose"
                  dir="rtl"
                  value={lyrics}
                  onChange={(e) => handleLyricsChange("darija", e.target.value)}
                />
              ) : (
                <textarea
                  className="input-field min-h-[320px] text-sm sm:text-base leading-relaxed"
                  value={lyricsFr}
                  onChange={(e) => handleLyricsChange("french", e.target.value)}
                />
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-3">
                <button
                  onClick={() => handleGenerateLyrics()}
                  disabled={loading || regeneratingLyrics}
                  className="flex-1 flex items-center justify-center gap-2 border border-emerald text-emerald hover:bg-emerald hover:text-white font-bold py-3.5 rounded-xl transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  {regeneratingLyrics
                    ? <><Loader2 size={16} className="animate-spin" /> Régénération...</>
                    : <><RefreshCw size={16} /> Régénérer d'autres paroles</>}
                </button>
                <button
                  onClick={handleValidateLyrics}
                  disabled={loading || regeneratingLyrics || !online}
                  className="flex-1 flex items-center justify-center gap-2 bg-henne hover:bg-henne-light text-white font-bold py-3.5 rounded-xl shadow-md transition-all text-sm sm:text-base cursor-pointer"
                >
                  Valider et Composer la Musique <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}