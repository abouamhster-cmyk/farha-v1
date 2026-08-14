import { useState, useRef } from "react";
import { callFunction } from "../lib/supabaseClient.js";
import { supabase } from "../lib/supabaseClient.js";
import SharePreview from "./SharePreview.jsx";
import { enablePush, pushSupported } from "../lib/push.js";
import {
  X, Share2, Send, Sparkles, Loader2, Check, Copy,
  User, MessageSquare, ImagePlus, Link2, Zap, ChevronLeft, Eye, Type, Bell, BellRing
} from "lucide-react";

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://farha-v1.vercel.app";

export default function ShareModal({ song, coverUrl, onClose }) {
  const [mode, setMode] = useState(null); // null | "direct" | "personalized"
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [error, setError] = useState("");

  const [senderName, setSenderName] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef(null);

  // Notifications push (créateur prévenu quand le destinataire écoute)
  const [pushState, setPushState] = useState("idle"); // idle | enabling | enabled | error
  const [pushError, setPushError] = useState("");

  async function handleEnablePush() {
    setPushState("enabling");
    setPushError("");
    try {
      await enablePush();
      setPushState("enabled");
    } catch (err) {
      setPushError(err?.message || "Activation impossible.");
      setPushState("error");
    }
  }

  const directUrl = `${SITE_URL}/ecouter/${song.id}`;

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 2 Mo.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  }

  async function confirmDirectShare() {
    setLoading(true);
    try {
      await callFunction("create-share-link", { songId: song.id, shareType: "direct" });
    } catch {}
    setShareUrl(directUrl);
    setLoading(false);
  }

  async function handlePersonalizedSubmit(e) {
    e.preventDefault();
    if (!senderName.trim()) {
      setError("Veuillez entrer votre nom.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      let photoPath = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${song.user_id}/${song.id}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("share-photos")
          .upload(path, photoFile, { upsert: true });
        if (uploadErr) throw new Error("Erreur lors de l'envoi de la photo.");
        photoPath = path;
      }

      const res = await callFunction("create-share-link", {
        songId: song.id,
        shareType: "personalized",
        senderName: senderName.trim(),
        title: title.trim() || null,
        message: message.trim() || null,
        photoPath,
      });

      const shareId = res?.shareId;
      if (!shareId) throw new Error("Erreur lors de la création du lien.");

      setShareUrl(`${SITE_URL}/ecouter/${song.id}?s=${shareId}`);
    } catch (err) {
      setError(err?.message || "Erreur lors de la création du lien.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Impossible de copier le lien.");
    }
  }

  async function nativeShare() {
    if (!shareUrl || !navigator.share) return;
    try {
      await navigator.share({
        title: "Une chanson pour toi — Farha",
        text: senderName ? `${senderName} t'a dédié une chanson sur Farha` : "Écoute cette chanson créée sur Farha",
        url: shareUrl,
      });
    } catch {}
  }

  const wide = (mode === "personalized" || mode === "direct") && !shareUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className={`relative w-full ${wide ? "max-w-[820px]" : "max-w-[480px]"} bg-white rounded-3xl p-5 sm:p-6 border border-line shadow-2xl my-auto max-h-[94vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-4 transition-all`}>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-cream hover:bg-line text-muted hover:text-ink flex items-center justify-center transition-colors cursor-pointer z-10"
        >
          <X size={16} />
        </button>

        <div className="pr-6">
          <div className="inline-flex items-center gap-1 text-safran text-[0.68rem] font-bold uppercase tracking-widest bg-safran/10 px-2.5 py-0.5 rounded-full border border-safran/20 mb-1">
            <Share2 size={11} /> Partager
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold leading-tight">Partager votre chanson</h2>
        </div>

        {/* ÉCRAN 1 : CHOIX DU MODE */}
        {!shareUrl && !mode && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("direct")}
              className="w-full p-4 rounded-2xl border border-line hover:border-emerald/50 bg-white hover:bg-emerald/5 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald/10 text-emerald flex items-center justify-center flex-shrink-0 group-hover:bg-emerald group-hover:text-white transition-colors">
                  <Zap size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-ink">Partage direct</div>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">
                    Un lien propre, une page d'écoute élégante. Vous verrez un aperçu avant de valider.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode("personalized")}
              className="w-full p-4 rounded-2xl border border-line hover:border-safran/50 bg-white hover:bg-safran/5 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-safran/10 text-safran flex items-center justify-center flex-shrink-0 group-hover:bg-safran group-hover:text-ink transition-colors">
                  <Sparkles size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-ink">Partage personnalisé</div>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">
                    Votre nom, un message, une photo. Le destinataire reçoit une page unique — avec aperçu en direct.
                  </p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* ÉCRAN 2a : DIRECT — aperçu avant validation */}
        {mode === "direct" && !shareUrl && (
          <div className="grid md:grid-cols-2 gap-5 items-start">
            <div className="order-2 md:order-1 space-y-3">
              <button onClick={() => setMode(null)} className="text-xs font-semibold text-muted hover:text-ink flex items-center gap-1 cursor-pointer">
                <ChevronLeft size={14} /> Retour
              </button>
              <p className="text-sm text-muted leading-relaxed">
                Voici la page que découvrira le destinataire. Épurée, centrée sur la musique.
              </p>
              <button
                onClick={confirmDirectShare}
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-emerald hover:bg-emerald-light text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Création…</> : <><Link2 size={16} /> Valider et obtenir le lien</>}
              </button>
              <button
                onClick={() => setMode("personalized")}
                className="w-full py-3 rounded-2xl border border-safran/40 text-safran hover:bg-safran/5 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} /> Plutôt personnaliser
              </button>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5"><Eye size={12} /> Aperçu</p>
              <SharePreview mode="direct" coverUrl={coverUrl} />
            </div>
          </div>
        )}

        {/* ÉCRAN 2b : PERSONNALISÉ — formulaire + aperçu en direct */}
        {mode === "personalized" && !shareUrl && (
          <div className="grid md:grid-cols-2 gap-5 items-start">
            <form onSubmit={handlePersonalizedSubmit} className="order-2 md:order-1 space-y-3.5">
              <button type="button" onClick={() => setMode(null)} className="text-xs font-semibold text-muted hover:text-ink flex items-center gap-1 cursor-pointer">
                <ChevronLeft size={14} /> Retour
              </button>

              {/* TITRE : champ principal, ce que verra le destinataire en grand */}
              <div className="bg-safran/5 border border-safran/25 rounded-2xl p-3">
                <label className="block text-[0.68rem] font-bold uppercase tracking-wider text-safran mb-1 flex items-center gap-1.5">
                  <Type size={13} /> Titre de la page
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Pour la meilleure maman du monde"
                  className="input-field text-sm"
                  maxLength={120}
                />
                <p className="text-[0.6rem] text-muted mt-1">
                  C'est le grand titre affiché au destinataire. Si vous le laissez vide, on met par défaut «&nbsp;{(senderName.trim() || "Votre nom")} vous a dédié une chanson&nbsp;».
                </p>
              </div>

              <div>
                <label className="block text-[0.68rem] font-bold uppercase tracking-wider text-muted mb-1">De la part de * (signature)</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Ex: Maman, Youssef, Ton ami Karim…"
                    className="input-field pl-9 text-sm"
                    maxLength={80}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[0.68rem] font-bold uppercase tracking-wider text-muted mb-1">Message (description)</label>
                <div className="relative">
                  <MessageSquare size={15} className="absolute left-3 top-3 text-muted" />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ex: Joyeux anniversaire, cette chanson est pour toi !"
                    className="input-field pl-9 text-sm min-h-[80px] resize-none"
                    maxLength={500}
                    rows={3}
                  />
                </div>
                <div className="text-right text-[0.6rem] text-muted mt-0.5">{message.length}/500</div>
              </div>

              <div>
                <label className="block text-[0.68rem] font-bold uppercase tracking-wider text-muted mb-1">Votre photo (optionnel)</label>
                {photoPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={photoPreview} alt="Aperçu" className="w-14 h-14 rounded-xl object-cover border border-line" />
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="text-xs font-bold text-henne hover:underline cursor-pointer">
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full p-3 rounded-xl border-2 border-dashed border-line hover:border-safran/50 text-muted hover:text-safran text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                    <ImagePlus size={16} /> Ajouter une photo (max 2 Mo)
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
              </div>

              {error && <div className="bg-henne/10 text-henne rounded-xl p-2.5 text-xs border border-henne/20">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 sm:py-3.5 rounded-2xl bg-safran hover:bg-safran-bright text-ink font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Création du lien…</> : <><Sparkles size={16} /> Créer mon lien personnalisé</>}
              </button>
            </form>

            <div className="order-1 md:order-2 md:sticky md:top-0">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5"><Eye size={12} /> Aperçu en direct</p>
              <SharePreview mode="personalized" coverUrl={coverUrl} senderName={senderName} title={title} message={message} photoPreview={photoPreview} />
            </div>
          </div>
        )}

        {/* ÉCRAN 3 : LIEN PRÊT */}
        {shareUrl && (
          <div className="space-y-4 animate-slideUp">
            <div className="bg-emerald/10 rounded-2xl p-4 border border-emerald/20">
              <div className="flex items-center gap-2 mb-2">
                <Check size={16} className="text-emerald" />
                <span className="font-bold text-sm text-emerald">Lien prêt !</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white rounded-xl px-3 py-2 text-xs text-muted font-mono truncate border border-line">{shareUrl}</div>
                <button onClick={copyLink} className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald text-white flex items-center justify-center hover:bg-emerald-light transition-colors cursor-pointer">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              {copied && <p className="text-xs text-emerald font-bold mt-1.5 animate-popIn">Lien copié !</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={copyLink} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-line hover:border-emerald text-sm font-bold text-ink hover:text-emerald transition-colors cursor-pointer">
                <Link2 size={15} /> Copier
              </button>
              {navigator.share && (
                <button onClick={nativeShare} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald hover:bg-emerald-light text-white text-sm font-bold transition-colors cursor-pointer">
                  <Send size={15} /> Envoyer
                </button>
              )}
            </div>

            {/* Notification push : être prévenu quand le destinataire écoute */}
            {pushSupported() && (
              <div className="bg-safran/5 border border-safran/25 rounded-2xl p-4">
                {pushState === "enabled" ? (
                  <div className="flex items-center gap-2.5 text-sm font-bold text-emerald">
                    <BellRing size={18} /> Notifications activées — vous serez prévenu à l'écoute.
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2.5 mb-3">
                      <Bell size={18} className="text-safran flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted leading-relaxed">
                        Soyez <strong className="text-ink">prévenu instantanément</strong> (notification sur votre téléphone, même verrouillé) quand le destinataire écoute la chanson.
                      </p>
                    </div>
                    <button
                      onClick={handleEnablePush}
                      disabled={pushState === "enabling"}
                      className="w-full py-2.5 rounded-xl bg-safran hover:bg-safran-bright text-ink text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {pushState === "enabling"
                        ? <><Loader2 size={15} className="animate-spin" /> Activation…</>
                        : <><Bell size={15} /> Activer les notifications</>}
                    </button>
                    {pushState === "error" && <p className="text-xs text-henne mt-2">{pushError}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
