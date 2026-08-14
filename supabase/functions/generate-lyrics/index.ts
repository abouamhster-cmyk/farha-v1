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

// Timbre de l'interprete (le "qui chante") — SEPARE de la perspective
// narrative (le "de qui / a qui parle la chanson"), gerée plus bas.
const VOICE_MAP: Record<string, string> = {
  homme: "interprétée par une voix masculine solo",
  femme: "interprétée par une voix féminine solo",
  duo: "interprétée en duo homme/femme qui se répondent (alterne les couplets entre les deux voix)",
  choeurs: "interprétée par un groupe / des chœurs (refrain repris en chœur)",
  enfant: "portée par une voix d'enfant au timbre doux et innocent",
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

  const perspective = target
    ? `PERSPECTIVE (TRÈS IMPORTANT) : La chanson est DÉDIÉE à "${target}". Le narrateur est la personne qui OFFRE la chanson (par exemple un parent qui chante POUR son enfant, un ami POUR un ami) et s'adresse à "${target}" avec sincérité et émotion. "${target}" n'est PAS le narrateur et ne chante pas sur lui-même — SAUF si le brief demande explicitement que "${target}" chante à la première personne. Mentionne "${target}" clairement plusieurs fois.`
    : `PERSPECTIVE : écris de façon naturelle et incarnée, à la première personne.`;

  return `Tu es un parolier professionnel reconnu. Écris les paroles d'une belle chanson en ${dialect}, sincère et naturelle — jamais robotique ni plaquée.

LANGUE / DIALECTE : ${dialect}. Utilise l'alphabet arabe pour la version principale.
STYLE MUSICAL : ${style}
INTERPRÉTATION : la chanson est ${voice}.
USAGE / AMBIANCE : ${categoryGuidance}
${perspective}
BRIEF DU CLIENT : "${song.brief}"

QUALITÉ & STRUCTURE :
- Reste fidèle au brief et à la perspective ci-dessus : c'est le plus important.
- Paroles fluides, imagées et émotionnelles, adaptées au dialecte du quotidien.
- Adapte la longueur et le ton au style : un morceau festif (chaâbi, raï) est riche et entraînant ; une berceuse ou une chanson tendre est plus douce, intime et peut être plus courte.
- Structure claire avec des balises : [Couplet 1], [Refrain] (mémorable, répété), [Couplet 2], [Pont] si pertinent, [Outro]. Plusieurs couplets et un vrai refrain.

FORMAT DE RÉPONSE STRICT (balises exactes) :
DARIJA:
[l'intégralité des paroles en arabe avec les balises [Couplet 1], [Refrain], etc.]

FRANCAIS:
[la traduction française complète, structurée exactement de la même manière]

GÉNÈRE MAINTENANT LA CHANSON :`;
}

// MODE LIBRE : le client a tout décrit lui-même dans le brief. On ne lui
// impose aucun preset de langue/style/voix — l'IA les déduit de sa demande.
function buildFreePrompt(song: {
  recipient_name: string | null;
  occasion: string | null;
  brief: string;
}): string {
  const target = song.recipient_name ?? "";
  const perspective = target
    ? `PERSPECTIVE (TRÈS IMPORTANT) : La chanson est DÉDIÉE à "${target}". Le narrateur est la personne qui OFFRE la chanson (ex : un parent POUR son enfant) et s'adresse à "${target}" avec émotion. "${target}" n'est PAS le narrateur et ne chante pas sur lui-même, SAUF si la demande le précise explicitement.`
    : `PERSPECTIVE : si la demande implique une dédicace "pour quelqu'un", écris du point de vue de celui qui offre la chanson et adresse-toi à cette personne (ne la fais pas chanter sur elle-même, sauf demande explicite).`;

  return `Tu es un parolier professionnel reconnu. Un client décrit LIBREMENT la chanson qu'il souhaite. Écris de belles paroles, sincères et naturelles, qui répondent EXACTEMENT à sa demande.

DEMANDE LIBRE DU CLIENT (référence absolue) :
"${song.brief}"

${perspective}

RÈGLES :
1. Déduis TOI-MÊME de la demande : la langue / le dialecte, le style musical, le type de voix et le TON. Respecte scrupuleusement tout ce que le client précise. S'il ne précise pas la langue, écris en darija marocaine authentique.
2. Écris la version principale dans la langue/dialecte demandé (alphabet arabe si c'est un dialecte arabe).
3. Adapte la longueur et le ton au type de chanson demandé (une berceuse est douce et intime ; un morceau festif est riche et entraînant). Évite les paroles plaquées ou robotiques.
4. Structure claire avec balises : [Couplet 1], [Refrain] (mémorable), [Couplet 2], [Pont] si pertinent, [Outro].

FORMAT DE RÉPONSE STRICT (balises exactes) :
DARIJA:
[l'intégralité des paroles dans la langue/dialecte demandé, avec les balises]

FRANCAIS:
[la traduction française complète, structurée exactement de la même manière]

GÉNÈRE MAINTENANT LA CHANSON :`;
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

    const { songId, freeMode } = await req.json();
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

    const prompt = freeMode ? buildFreePrompt(song) : buildPrompt(song);
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

    // Historique GRATUIT : on empile les paroles precedentes avant de les
    // remplacer, pour pouvoir revenir en arriere. On plafonne a 10 entrees.
    const priorHistory = Array.isArray(song.lyrics_history) ? song.lyrics_history : [];
    const nextHistory = song.lyrics
      ? [
          ...priorHistory,
          {
            lyrics: song.lyrics,
            lyrics_fr: song.lyrics_fr ?? null,
            version: song.lyrics_version,
            saved_at: new Date().toISOString(),
          },
        ].slice(-10)
      : priorHistory;

    // Update CRITIQUE : uniquement des colonnes garanties. Ne casse jamais.
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

    // Best-effort : colonnes optionnelles (migrations 0013 / 0017). Chaque
    // update est isolé et sans throw : si la colonne n'existe pas encore,
    // la génération reste OK (l'erreur est simplement ignorée).
    await admin.from("songs").update({ lyrics_history: nextHistory }).eq("id", songId);
    await admin.from("songs").update({ free_mode: !!freeMode }).eq("id", songId);

    const { data: fresh } = await admin.from("songs").select("*").eq("id", songId).maybeSingle();

    return jsonResponse({ song: fresh ?? updated });
  } catch (err) {
    console.error("Lyrics generation error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }  
});