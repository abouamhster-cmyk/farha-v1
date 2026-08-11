declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";
import { detectSensitiveTopic, sensitiveTopicMessage } from "../_shared/moderation.ts";

const MAX_REGENERATIONS = 4;
const MIN_LINES = 16;
const MAX_RETRIES = 3;

// Modèles Gemini Flash actifs (basés sur Google AI Studio)
const GEMINI_FLASH_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"];

// --- SUPPORT COMPLET DES 9 DIALECTES ---
const DIALECT_MAP: Record<string, string> = {
  marocain: "darija marocaine authentique (dialecte marocain du quotidien, vocabulaire courant, PAS d'arabe littéraire)",
  algerien: "darija algérienne authentique (dialecte algérien du quotidien, expressions populaires, PAS d'arabe littéraire)",
  tunisien: "darija tunisienne authentique (dialecte tunisien du quotidien, expressions locales, PAS d'arabe littéraire)",
  libyen: "lahja libyenne authentique (dialecte libyen du quotidien, expressions populaires)",
  mauritaniene: "hassanya mauritanienne authentique (dialecte hassanya du quotidien)",
  egyptien: "lahja masriya égyptienne populaire du quotidien (المصرية - Masri, expressions cairote du quotidien, t'a marbota, habibi, ya basha)",
  levantin: "lahja shamiya levantine authentique (الشامية - Liban, Syrie, Jordanie, Palestine)",
  khaleeji: "lahja khaleeji authentique du Golfe (الخليجية - Saoudite, Émirats, Koweït)",
  fusha: "arabe littéraire poétique moderne et majestueux (العربية الفصحى)",
};

const STYLE_MAP: Record<string, string> = {
  chaabi: "chaâbi traditionnel et festif maghrébin (rythmé, populaire, joyeux)",
  rai: "raï moderne et club (festif, dansant, percutant)",
  rap: "rap et trap darija moderne (punchlines, rythme urbain, beat percutant et flow moderne)",
  pop: "pop orientale moderne (mélodique, accrocheuse, chaleureuse)",
  acoustique: "acoustique intimiste (guitare, voix douce, chill)",
  gnawa: "gnawa fusion (guembri, qraqeb, rythme envoûtant, fusion moderne)",
  oriental: "orientale classique et andalouse (violons, oud, cordes, majestueux)",
  mezwed: "mezwed tunisien populaire (festif, cornemuse mezwed, rythme entraînant de fête)",
  amazigh: "amazigh/berbère (rythmes traditionnels du bendir, chant collectif, identité culturelle forte)",
  rnb: "R&B/afrobeat fusion moderne (groove chaloupé, mélodie soul, ambiance urbaine actuelle)",
};

const VOICE_MAP: Record<string, string> = {
  homme: "voix masculine solo — écris à la première personne du masculin",
  femme: "voix féminine solo — écris à la première personne du féminin",
  duo: "duo homme/femme qui se répondent — alterne des lignes/couplets entre une voix masculine et une voix féminine, comme un dialogue chanté",
  choeurs: "groupe/chœurs qui chantent ensemble — écris au \"nous\", refrain pensé pour être repris en chœur par plusieurs voix",
  enfant: "voix d'enfant — ton innocent, joyeux et simple, vocabulaire accessible à un enfant",
};

function buildPrompt(song: {
  dialect: string;
  music_style: string;
  voice_type: string;
  recipient_name: string | null;
  occasion: string | null;
  brief: string;
}): string {
  const dialect = DIALECT_MAP[song.dialect] ?? DIALECT_MAP.marocain;
  const style = STYLE_MAP[song.music_style] ?? STYLE_MAP.chaabi;
  const voice = VOICE_MAP[song.voice_type] ?? VOICE_MAP.homme;
  const target = song.recipient_name ?? "";
  const category = song.occasion ?? "TikTok / Reels";

  let categoryGuidance = "";
  if (category.includes("TikTok") || category.includes("Reels")) {
    categoryGuidance = "FORMAT TIKTOK / REELS : Écris un morceau très accrocheur avec un REFRAIN VIRAL de 15 secondes facile à retenir et à chanter sur les réseaux sociaux. Vocabulaire moderne et dynamique.";
  } else if (category.includes("Pub") || category.includes("Business")) {
    categoryGuidance = "FORMAT PUBLICITÉ & COMMERCIAL : Écris un jingle / chanson de promotion accrocheuse pour une marque ou un commerce. Mets en avant les qualités du produit/service avec des slogans positifs et énergiques.";
  } else if (category.includes("Humour") || category.includes("Memes")) {
    categoryGuidance = "FORMAT HUMOUR & PARODIE : Écris des paroles drôles, amicales et pleines de punchlines comiques basées sur les blagues ou détails fournis. Garde un ton bon enfant et amusant.";
  } else {
    categoryGuidance = "FORMAT CÉLÉBRATION & FÊTE : Écris une chanson festive, chaleureuse et émouvante pour célébrer ce moment en famille ou entre amis.";
  }

  return `Tu es un auteur-compositeur et parolier professionnel de premier plan. Écris les paroles d'une chanson COMPLÈTE, longue et détaillée en ${dialect}.

LANGUE / DIALECTE : ${dialect}. Utilise l'alphabet arabe pour la version principale.
STYLE MUSICAL : ${style}
VOIX : ${voice}
USAGE / AMBIANCE : ${categoryGuidance}
${target ? `SUJET / MARQUE / DESTINATAIRE : ${target} — doit être mentionné clairement plusieurs fois.` : ""}
INSTRUCTIONS / BRIEF CLIENT : "${song.brief}"

RÈGLES ANTI-PARESSE STRICTES (POUR ÉVITER LES TEXTES TROP COURTS) :
1. LONGUEUR MINIMALE : Le texte total de la chanson doit être riche, dense et faire au moins 300 à 400 mots. Interdiction d'écrire des phrases minimalistes ou des vers de 2 ou 3 mots. Chaque ligne doit être complète et rythmée.
2. STRUCTURE COMPLÈTE OBLIGATOIRE :
   - [Couplet 1] : 6 à 8 lignes complètes. Développe l'introduction et le décor.
   - [Refrain] : 4 lignes percutantes et mémorables.
   - [Couplet 2] : 6 à 8 lignes complètes. Fais progresser l'histoire ou le message.
   - [Refrain] : 4 lignes.
   - [Pont] : 4 à 6 lignes. Change de rythme et apporte une réflexion ou une émotion profonde.
   - [Refrain] : 4 lignes.
   - [Outro] : 4 lignes de conclusion en dégradé.

FORMAT DE RÉPONSE STRICT (Respecte ces balises exactes) :
DARIJA:
[Mets ici l'intégralité des paroles en arabe avec les balises [Couplet 1], [Refrain], [Pont], etc.]

FRANCAIS:
[Mets ici la traduction française complète, structurée exactement de la même manière]

GÉNÈRE MAINTENANT LA CHANSON COMPLÈTE :`;
}

function parseLyrics(raw: string): { darija: string; french: string } {
  const cleaned = raw.replace(/\*+/g, "").replace(/#+\s*/g, "").trim();

  const darijaMatch = cleaned.match(/DARIJA\s*:\s*([\s\S]*?)(?=FRAN[CÇ]AIS\s*:|$)/i);
  const frenchMatch = cleaned.match(/FRAN[CÇ]AIS\s*:\s*([\s\S]*?)$/i);

  const darija = (darijaMatch?.[1] ?? cleaned).replace(/^DARIJA\s*:\s*/i, "").trim();
  const french = (frenchMatch?.[1] ?? "").replace(/^FRAN[CÇ]AIS\s*:\s*/i, "").trim();

  return { darija, french: french || darija };
}

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { songId } = await req.json();
    if (!songId) return jsonResponse({ error: "songId requis" }, 400);

    const admin = getSupabaseAdmin();

    const { data: song, error: fetchErr } = await admin
      .from("songs")
      .select("*")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !song) return jsonResponse({ error: "Chanson introuvable" }, 404);

    if (song.lyrics_version >= MAX_REGENERATIONS) {
      return jsonResponse({ error: "Nombre maximum de régénérations atteint." }, 429);
    }

    const sensitiveTopic = detectSensitiveTopic(song.brief, song.occasion, song.recipient_name);
    if (sensitiveTopic) {
      await admin.from("songs").update({
        status: "failed",
        failure_reason: sensitiveTopicMessage(sensitiveTopic),
      }).eq("id", songId);
      return jsonResponse({ error: sensitiveTopicMessage(sensitiveTopic) }, 422);
    }

    await admin.from("songs").update({ status: "lyrics_generating" }).eq("id", songId);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY manquante");

    const prompt = buildPrompt(song);
    let darija: string | null = null;
    let french: string | null = null;

    for (const modelName of GEMINI_FLASH_MODELS) {
      if (darija) break;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const extra = attempt > 0
          ? "\n\nATTENTION : ta réponse précédente était incomplète. Écris les DEUX sections DARIJA: et FRANCAIS: complètes."
          : "";

        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt + extra }] }],
                generationConfig: { maxOutputTokens: 6000 },
              }),
            }
          );

          if (!resp.ok) {
            console.error(`Modèle ${modelName} - Tentative ${attempt + 1}:`, await resp.text());
            continue;
          }

          const data = await resp.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!raw) continue;

          const parsed = parseLyrics(raw);
          const lineCount = parsed.darija.split("\n").filter((l: string) => l.trim().length > 3).length;

          if (lineCount >= MIN_LINES) {
            darija = parsed.darija;
            french = parsed.french || null;
            break;
          }
        } catch (err) {
          console.warn(`Model ${modelName} exception:`, err);
        }
      }
    }

    if (!darija) {
      await admin.from("songs").update({ status: "failed", failure_reason: "Génération des paroles incomplète." }).eq("id", songId);
      throw new Error("Paroles incomplètes. Veuillez réessayer.");
    }

    const { data: updated, error: updateErr } = await admin
      .from("songs")
      .update({
        lyrics: darija,
        lyrics_fr: french,
        lyrics_version: song.lyrics_version + 1,
        status: "lyrics_ready",
      })
      .eq("id", songId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return jsonResponse({ song: updated });
  } catch (err) {
    console.error("Lyrics generation error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }  
});