// Détection BASIQUE de sujets sensibles — une liste de mots-clés, pas un
// vrai modèle de modération. Objectif : éviter de payer une génération
// (paroles et/ou musique) vouée à l'échec silencieux, et donner à
// l'utilisateur un message clair au lieu d'une erreur technique opaque.
//
// Pourquoi ça existe : cas réel observé en prod — une chanson satirique sur
// la politique a généré des paroles sans problème (le modèle de texte est
// permissif), mais la génération AUDIO a été refusée par Gemini ET Vertex
// (le modèle audio est plus strict) — status 'failed', message générique
// "Aucun modèle n'a pu générer l'audio.", aucune explication pour
// l'utilisateur, coût de génération des paroles dépensé pour rien.
//
// Volontairement permissif (faux négatifs > faux positifs) : mieux vaut
// laisser passer un sujet limite que bloquer une vraie chanson de fête.
interface SensitiveCategory {
  label: string; // montré à l'utilisateur, doit rester compréhensible
  pattern: RegExp;
}

const SENSITIVE_CATEGORIES: SensitiveCategory[] = [
  {
    label: "politique",
    pattern: /\b(politiqu\w*|président\w*|gouvernement\w*|élections?|corruption\w*|ministre\w*|parti politique|makhzen|رئيس|حكومة|سياسة|فساد|انتخابات)\b/iu,
  },
  {
    label: "violence",
    pattern: /\b(terroris\w*|attentat\w*|meurtre\w*|assassin\w*|égorg\w*|armes? à feu|إرهاب|قتل)\b/iu,
  },
  {
    label: "haine / discrimination",
    pattern: /\b(racis\w*|nazi\w*|antisémit\w*|homophob\w*|كراهية)\b/iu,
  },
  {
    label: "contenu sexuel explicite",
    pattern: /\b(porno\w*|sexe explicite)\b/iu,
  },
  {
    label: "drogue",
    pattern: /\b(cocaïne|héroïne|trafic de drogue|مخدرات)\b/iu,
  },
];

// Retourne le libellé de la première catégorie détectée, ou null si rien
// ne matche. Prend plusieurs champs texte (brief, occasion, paroles...) en
// une seule passe.
export function detectSensitiveTopic(...texts: Array<string | null | undefined>): string | null {
  const combined = texts.filter(Boolean).join(" \n ");
  if (!combined.trim()) return null;

  for (const { label, pattern } of SENSITIVE_CATEGORIES) {
    if (pattern.test(combined)) return label;
  }
  return null;
}

export function sensitiveTopicMessage(label: string): string {
  return `Ce sujet (${label}) ne peut pas être transformé en chanson par notre IA. Modifiez votre description et réessayez.`;
}
