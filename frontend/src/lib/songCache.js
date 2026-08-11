// Cache persistant pour les chansons en cours de création.
// Sauvegarde dans localStorage pour survivre aux :
// - Perte de connexion
// - Rafraîchissement de page
// - Erreur réseau
// - Fermeture accidentelle du navigateur

const CACHE_KEY = "farha_song_draft";

export function saveDraft(data) {
  try {
    const payload = {
      ...data,
      savedAt: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Impossible de sauvegarder le brouillon:", e);
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Expire après 24h
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      clearDraft();
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // silencieux
  }
}
