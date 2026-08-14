import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

const DISMISS_KEY = "farha_install_dismissed";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
}

// Bannière d'installation : invite discrète à installer l'app.
//   - Android / Chrome / Edge : bouton natif "Installer".
//   - iPhone (Safari) : instructions "Partager -> Sur l'écran d'accueil"
//     (obligatoire chez Apple pour recevoir les notifications push).
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS n'émet pas beforeinstallprompt -> on montre l'aide manuelle.
    if (isIOS()) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", onBeforeInstall); };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    setShow(false);
    setIosHint(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  async function install() {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch {}
      setDeferred(null);
      dismiss();
    } else if (isIOS()) {
      setIosHint((v) => !v);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-[360px] z-[90] animate-slideUp">
      <div className="bg-[#0C0F0E] text-white rounded-2xl shadow-2xl border border-white/10 p-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-safran/20 rounded-full blur-2xl pointer-events-none" />
        <button onClick={dismiss} className="absolute top-2.5 right-2.5 text-white/40 hover:text-white transition-colors">
          <X size={16} />
        </button>

        <div className="relative flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-safran to-henne flex items-center justify-center flex-shrink-0">
            <Download size={20} className="text-white" />
          </div>
          <div className="min-w-0 pr-4">
            <p className="font-bold text-sm">Installer Farha</p>
            <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
              Accès rapide + notifications quand vos chansons sont écoutées.
            </p>
          </div>
        </div>

        {iosHint ? (
          <div className="relative mt-3 bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white/80 leading-relaxed space-y-1.5">
            <p className="flex items-center gap-1.5">
              1. Appuyez sur <Share size={13} className="text-safran inline" /> <span className="font-semibold">Partager</span> (barre Safari)
            </p>
            <p className="flex items-center gap-1.5">
              2. Puis <Plus size={13} className="text-safran inline" /> <span className="font-semibold">Sur l'écran d'accueil</span>
            </p>
          </div>
        ) : (
          <button
            onClick={install}
            className="relative mt-3 w-full py-2.5 rounded-xl bg-safran hover:bg-safran-bright text-ink text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Download size={15} /> {isIOS() ? "Comment installer" : "Installer l'application"}
          </button>
        )}
      </div>
    </div>
  );
}
