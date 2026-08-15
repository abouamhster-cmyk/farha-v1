// Cache persistant pour les chansons en cours de création.
// Sauvegarde dans localStorage pour survivre aux :
// - Perte de connexion
// - Rafraîchissement de page
// - Erreur réseau
// - Fermeture accidentelle du navigateur

// IMPORTANT : le brouillon est scope PAR UTILISATEUR. Sans ca, un compte
// verrait le brouillon (et le songId) d'un autre compte sur le meme
// navigateur -> "Chanson introuvable" et fuite de donnees.
const CACHE_KEY_BASE = "farha_song_draft";

function draftKey(userId) {
  return userId ? `${CACHE_KEY_BASE}_${userId}` : CACHE_KEY_BASE;
}

export function saveDraft(userId, data) {
  if (!userId) return; // pas de brouillon anonyme
  try {
    const payload = { ...data, savedAt: Date.now() };
    localStorage.setItem(draftKey(userId), JSON.stringify(payload));
  } catch (e) {
    console.warn("Impossible de sauvegarder le brouillon:", e);
  }
}

export function loadDraft(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
      clearDraft(userId);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

export function clearDraft(userId) {
  try {
    localStorage.removeItem(draftKey(userId));
    // Nettoyage de l'ancien format global (migration douce).
    localStorage.removeItem(CACHE_KEY_BASE);
  } catch (e) {
    // silencieux
  }
}

// -------------------------------------------------------------------
// Cache "stale-while-revalidate" de la liste des chansons du tableau
// de bord : on affiche instantanement la derniere liste connue, puis
// on rafraichit en arriere-plan. Evite le spinner a chaque visite.
// -------------------------------------------------------------------

const LIST_KEY_PREFIX = "farha_songs_list_";

export function getCachedSongs(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(LIST_KEY_PREFIX + userId);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // On garde le cache 24h max pour ne pas afficher des donnees trop vieilles
    if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) return null;
    return Array.isArray(data.songs) ? data.songs : null;
  } catch (e) {
    return null;
  }
}

export function setCachedSongs(userId, songs) {
  if (!userId) return;
  try {
    localStorage.setItem(
      LIST_KEY_PREFIX + userId,
      JSON.stringify({ songs, savedAt: Date.now() })
    );
  } catch (e) {
    // silencieux (quota depasse, mode prive, etc.)
  }
}
