declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";
import { generateAndUploadCover } from "../_shared/coverImage.ts";
import { detectSensitiveTopic, sensitiveTopicMessage } from "../_shared/moderation.ts";
import { truncateAudioBytes } from "../_shared/audioTruncate.ts";
import { hasPremiumStyleAccess } from "../_shared/entitlement.ts";
import { sunoEnabled, sunoUploadCover } from "../_shared/suno.ts";

// Modele Gemini multimodal utilise pour "ecouter" l'extrait de reference
// et en decrire le style musical (Voie A, fonctionnalite premium).
const STYLE_ANALYSIS_MODEL = "gemini-2.5-flash";

// Convertit des octets en base64 (par blocs pour eviter les stack overflow).
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Envoie l'extrait audio a Gemini et renvoie une description de style
// prete a etre utilisee comme prompt Lyria. null si echec (on retombe
// alors sur le style choisi/par defaut).
async function describeStyleFromAudio(geminiKey: string, audioBytes: Uint8Array, mime: string): Promise<string | null> {
  try {
    const base64 = bytesToBase64(audioBytes);
    const instruction = `You are a music producer. Listen to this audio excerpt and describe its STYLE so another AI can compose a NEW song in the same vibe (do NOT transcribe or copy it). In 3-4 concise English sentences, describe: genre and regional flavor, approximate tempo/BPM, main instruments, groove/rhythm, mood, and vocal type. Output ONLY the style description, as production tags.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${STYLE_ANALYSIS_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: instruction },
              { inline_data: { mime_type: mime || "audio/mpeg", data: base64 } },
            ],
          }],
          generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
        }),
      }
    );

    if (!resp.ok) {
      console.warn("describeStyleFromAudio HTTP", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleaned = (text || "").replace(/\*+/g, "").replace(/#+/g, "").trim();
    return cleaned.length > 20 ? cleaned : null;
  } catch (err) {
    console.warn("describeStyleFromAudio exception:", err);
    return null;
  }
}

const PREVIEW_SECONDS = 40;
const GEMINI_RETRIES = 2;
// Extrait gratuit : UNE seule fois a vie (pas par jour).
const FREE_LIFETIME_GENERATIONS = Number(Deno.env.get("FREE_LIFETIME_GENERATIONS") ?? "1");
const DEFAULT_FREE_DURATION = 60;

const STYLE_PROMPTS: Record<string, string> = {
  chaabi: "Authentic Moroccan/Algerian Chaâbi, festive and popular. Bendir and derbouka percussion, ghaita and violin lines, oud, energetic call-and-response handclaps and group backing vocals. Warm live-band wedding-party energy, tight infectious groove, ~120 BPM. Punchy, rich, radio-ready mix.",
  rai: "Modern Algerian Raï, club-pop. Accordion and synth leads over a driving danceable groove, deep bass, darbouka blended with electronic drums. Emotional, slightly melancholic Phrygian-flavored melodies, powerful expressive lead vocal, huge catchy hook. Polished contemporary production, ~118 BPM.",
  rap: "Maghrebi trap/rap in Darija. Hard-hitting 808 sub-bass, crisp rolling hi-hats, dark cinematic melodic loop, punchy knocking drums. Confident modern flow, tasteful autotune, hard radio-ready mix, ~140 BPM.",
  pop: "Contemporary Arabic/Maghrebi pop. Bright synths, warm bass, tight modern drum groove, lush layered vocal harmonies, a big uplifting sing-along chorus. Clean glossy emotional radio production, ~104 BPM.",
  acoustique: "Intimate acoustic ballad. Soft nylon-guitar fingerpicking, warm string pad, gentle brushed percussion, breathy heartfelt close-miked vocal. Tender, emotional, cinematic, ~76 BPM.",
  gnawa: "Gnawa fusion. Hypnotic guembri sub-bass line, metallic qraqeb castanets, deep call-and-response chants over a trance groove with modern polish. Spiritual, hypnotic, powerful, ~112 BPM.",
  oriental: "Classical Arabic/Andalusian oriental. Expressive solo violin and oud, qanun and ney, rich string section, tasteful maqam ornamentation, subtle riqq percussion. Elegant, majestic, deeply emotional, cinematic, ~92 BPM.",
  mezwed: "Tunisian Mezwed. Mezwed bagpipe and zokra lead, driving wedding-party percussion (darbouka, bendir), festive call-and-response vocals. Hot, danceable, celebratory, ~126 BPM.",
  amazigh: "Amazigh (Berber) roots. Bendir and allun frame drums, collective ahwash/ahidus call-and-response chanting, hypnotic tribal rhythm with modern polish. Proud, rootsy, uplifting, ~108 BPM.",
  rnb: "Modern R&B / Afro-fusion with Maghrebi soul. Smooth lush chords, warm sub-bass, laid-back Afrobeat groove, silky expressive lead vocal with rich harmonies. Sensual, emotional, contemporary radio production, ~96 BPM.",
};

const VOICE_PROMPTS: Record<string, string> = {
  homme: "Solo male lead vocal, warm and expressive, natural phrasing, emotionally engaged.",
  femme: "Solo female lead vocal, warm and expressive, natural phrasing, emotionally engaged.",
  duo: "Male and female duet trading lines in the verses and blending in harmony on the chorus, natural chemistry.",
  choeurs: "Group/choir vocals, several voices in unison and harmony, big communal sing-along chorus.",
  enfant: "Child lead vocal, innocent, joyful and tender, natural (never robotic).",
};

// Directive de production commune : pousse Suno vers un rendu pro,
// cohérent musicalement et émotionnel (fini le "décalé").
const PRODUCTION_DIRECTIVE =
  "PROFESSIONAL PRODUCTION: authentic instrumentation for the genre, cohesive arrangement, clean radio-ready mix. Vocals perfectly in tune and in rhythm with clear, natural, emotional delivery. Keep a single consistent key and tempo throughout; melody and chords must stay musically coherent. Strong, memorable, catchy chorus hook. The song should feel like a real professional track and be genuinely moving.";

function sanitizeForLyria(text: string): string {
  if (!text) return "";
  return text
    .replace(/\btiktok\b/gi, "social video")
    .replace(/\breels?\b/gi, "short video")
    .replace(/\binstagram\b/gi, "social platform")
    .replace(/\bfacebook\b/gi, "social media")
    .replace(/\bwhatsapp\b/gi, "messaging app")
    .replace(/\byoutube\b/gi, "video platform")
    .replace(/\batlas wear\b/gi, "clothing brand")
    .replace(/\bmaster\b/gi, "degree")
    .replace(/\[.*?\]/g, "")
    .replace(/\*+/g, "")
    .replace(/#+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const OCCASION_LABELS: Record<string, string> = {
  anniversaire: "birthday celebration",
  mariage: "wedding celebration",
  diplome: "graduation celebration",
  naissance: "birth celebration, welcoming a new baby",
  fiancailles: "engagement celebration",
  retraite: "retirement tribute",
  promotion: "career promotion celebration",
  amour: "love song",
  amitie: "friendship tribute",
  fete: "festive party",
};

function buildFallbackPrompt(
  stylePrompt: string,
  voicePrompt: string,
  occasion: string,
  recipientName: string,
  brief: string,
  lyricsFr: string,
  maxDurationSeconds: number,
): string {
  const d = maxDurationSeconds;
  const maxFmt = formatTimestamp(d);
  const minFmt = formatTimestamp(Math.round(d * 0.85));

  const theme = OCCASION_LABELS[occasion] || "festive celebration";
  const nameInfo = recipientName ? `The song is dedicated to ${recipientName}.` : "";
  const briefInfo = brief ? `Context from the user: ${sanitizeForLyria(brief)}` : "";

  let lyricsContext = "";
  if (lyricsFr) {
    const cleaned = sanitizeForLyria(lyricsFr).slice(0, 1500);
    lyricsContext = `\nThe user originally wrote lyrics with these themes and ideas (use them as inspiration, rephrase freely):\n${cleaned}\n`;
  }

  return `${stylePrompt} ${voicePrompt}

${PRODUCTION_DIRECTIVE}

Compose a complete original song for a ${theme}. ${nameInfo} ${briefInfo}
${lyricsContext}
Write and sing your own lyrics inspired by the themes above. Sing in Moroccan Darija (Arabic dialect). Be creative, joyful, and authentic. Keep the same spirit and key ideas from the original but use your own words.

Structure:
[0:00 - ${formatTimestamp(Math.round(d * 0.08))}] Intro — Instrumental opening, building atmosphere
[${formatTimestamp(Math.round(d * 0.08))} - ${formatTimestamp(Math.round(d * 0.30))}] Verse 1 — Moderate energy, storytelling
[${formatTimestamp(Math.round(d * 0.30))} - ${formatTimestamp(Math.round(d * 0.50))}] Chorus — Full energy, catchy hook
[${formatTimestamp(Math.round(d * 0.50))} - ${formatTimestamp(Math.round(d * 0.68))}] Verse 2 — Variations, building emotion
[${formatTimestamp(Math.round(d * 0.68))} - ${formatTimestamp(Math.round(d * 0.85))}] Final Chorus — Peak energy
[${formatTimestamp(Math.round(d * 0.85))} - ${maxFmt}] Outro — Fade to silence

CRITICAL: Duration between ${minFmt} and ${maxFmt}. End with a natural fade-out.`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function buildMusicPrompt(stylePrompt: string, voicePrompt: string, lyrics: string, maxDurationSeconds: number): string {
  const cleanLyrics = sanitizeForLyria(lyrics);
  const lines = cleanLyrics
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  const totalLines = lines.length;
  const d = maxDurationSeconds;

  const verse1End = Math.min(Math.ceil(totalLines * 0.25), totalLines);
  const chorusEnd = Math.min(verse1End + Math.ceil(totalLines * 0.2), totalLines);
  const verse2End = Math.min(chorusEnd + Math.ceil(totalLines * 0.25), totalLines);
  const chorus2End = Math.min(verse2End + Math.ceil(totalLines * 0.2), totalLines);

  const verse1 = lines.slice(0, verse1End).join("\n");
  const chorus1 = lines.slice(verse1End, chorusEnd).join("\n");
  const verse2 = lines.slice(chorusEnd, verse2End).join("\n");
  const chorus2 = lines.slice(verse2End, chorus2End).join("\n");
  const outro = lines.slice(chorus2End).join("\n") || chorus1;

  const tIntro = Math.round(d * 0.08);
  const tVerse1 = Math.round(d * 0.30);
  const tChorus1 = Math.round(d * 0.50);
  const tVerse2 = Math.round(d * 0.68);
  const tChorus2 = Math.round(d * 0.85);
  const minDuration = Math.round(d * 0.85);
  const minDurationFormatted = `${Math.floor(minDuration / 60)}:${(minDuration % 60).toString().padStart(2, "0")}`;
  const maxDurationFormatted = formatTimestamp(d);

  return `${stylePrompt} ${voicePrompt}

${PRODUCTION_DIRECTIVE}

Composition Breakdown & Timestamps:

[0:00 - ${formatTimestamp(tIntro)}] Intro
Intensity: 3/10
Instrumental opening. ${stylePrompt} Gentle start building atmosphere. No vocals yet.

[${formatTimestamp(tIntro)} - ${formatTimestamp(tVerse1)}] Verse 1
Intensity: 5/10
${voicePrompt} Singing with clear emotional rhythm over the instrumental bed.
Lyrics:
${verse1}

[${formatTimestamp(tVerse1)} - ${formatTimestamp(tChorus1)}] Chorus
Intensity: 8/10
Full energy, catchy memorable melody, all instruments in. Strong hook.
Lyrics:
${chorus1}

[${formatTimestamp(tChorus1)} - ${formatTimestamp(tVerse2)}] Verse 2
Intensity: 5/10
Second verse, same melodic pattern as verse 1 with slight variations.
Lyrics:
${verse2}

[${formatTimestamp(tVerse2)} - ${formatTimestamp(tChorus2)}] Chorus (Reprise & Bridge)
Intensity: 9/10
Peak energy, fuller arrangement than first chorus, maximum emotional impact.
Lyrics:
${chorus2}

[${formatTimestamp(tChorus2)} - ${maxDurationFormatted}] Outro / Fade Out
Intensity: 4/10 → 1/10
Final section. Gradual wind-down. Instruments drop out one by one. Vocals fade softly. The song MUST conclude naturally with a final sustained note or resolving chord that fades into COMPLETE SILENCE before ${maxDurationFormatted}. Do NOT cut off mid-phrase.
Lyrics:
${outro}

CRITICAL: Expand the song duration naturally to fill between ${minDurationFormatted} and ${maxDurationFormatted} minutes total. Vocal pacing must be clear and natural to fit all lyrics. Conclude with an intentional fade-out to silence.`;
}

// Prompt pour un INSTRUMENTAL (aucune parole, aucune voix).
function buildInstrumentalPrompt(stylePrompt: string, brief: string, occasion: string, maxDurationSeconds: number): string {
  const d = maxDurationSeconds;
  const minFmt = formatTimestamp(Math.round(d * 0.85));
  const maxFmt = formatTimestamp(d);
  const briefInfo = brief ? sanitizeForLyria(brief) : "";
  const theme = occasion ? sanitizeForLyria(occasion) : "";

  return `${stylePrompt}

${PRODUCTION_DIRECTIVE}

Compose a COMPLETE INSTRUMENTAL track. ABSOLUTELY NO vocals, NO lyrics, NO singing, NO spoken words, NO vocal samples — purely instrumental.
${briefInfo ? `Creative direction from the client: ${briefInfo}` : ""}
${theme ? `Intended use / vibe: ${theme}.` : ""}

Structure:
[0:00 - ${formatTimestamp(Math.round(d * 0.12))}] Intro — set the atmosphere, introduce the main sound.
[${formatTimestamp(Math.round(d * 0.12))} - ${formatTimestamp(Math.round(d * 0.5))}] Main theme — a memorable, catchy melodic hook, full arrangement.
[${formatTimestamp(Math.round(d * 0.5))} - ${formatTimestamp(Math.round(d * 0.8))}] Variation / bridge — develop the theme, add energy or emotion.
[${formatTimestamp(Math.round(d * 0.8))} - ${maxFmt}] Outro — resolve and fade cleanly to silence before ${maxFmt}.

CRITICAL: Instrumental only (no voice at all). Duration between ${minFmt} and ${maxFmt}. End with a natural fade-out to silence.`;
}

async function getUserMaxDuration(admin: any, userId: string): Promise<number> {
  try {
    const { data: orders } = await admin
      .from("orders")
      .select("pack_id")
      .eq("user_id", userId)
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    if (!orders || orders.length === 0) return DEFAULT_FREE_DURATION;

    const packIds = [...new Set(orders.map((o: any) => o.pack_id))];
    const { data: packs } = await admin
      .from("pricing_packs")
      .select("id, max_duration_seconds")
      .in("id", packIds);

    if (!packs || packs.length === 0) return DEFAULT_FREE_DURATION;

    const maxDuration = Math.max(...packs.map((p: any) => p.max_duration_seconds ?? DEFAULT_FREE_DURATION));
    return maxDuration;
  } catch (err) {
    console.warn("getUserMaxDuration error, using default:", err);
    return DEFAULT_FREE_DURATION;
  }
}

interface LyriaResult {
  audioBase64: string;
  mimeType: string;
}

const MODEL_PRO = "lyria-3-pro-preview";

const LIBERAL_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

async function callGeminiLyria(geminiKey: string, prompt: string): Promise<LyriaResult | "blocked" | null> {
  for (let attempt = 0; attempt < GEMINI_RETRIES; attempt++) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_PRO}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: LIBERAL_SAFETY_SETTINGS,
            generationConfig: {
              maxOutputTokens: 65536,
            },
          }),
        }
      );

      if (!resp.ok) {
        console.warn(`Gemini Lyria HTTP ${resp.status} (tentative ${attempt + 1}/${GEMINI_RETRIES}):`, await resp.text());
        continue;
      }

      const data = await resp.json();

      const blockReason = data?.promptFeedback?.blockReason;
      const finishReason = data?.candidates?.[0]?.finishReason;
      if (blockReason || finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
        console.warn(`Gemini Lyria a refusé la génération pour raison de sécurité (${blockReason ?? finishReason}).`);
        return "blocked";
      }

      if (finishReason === "MAX_TOKENS") {
        console.warn(`Gemini Lyria a coupé la génération (MAX_TOKENS) — tentative ${attempt + 1}/${GEMINI_RETRIES}.`);
        continue;
      }

      const parts = data?.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      for (const part of parts) {
        if (part.inlineData?.data) {
          return {
            audioBase64: part.inlineData.data,
            mimeType: part.inlineData.mimeType ?? "audio/mp3",
          };
        }
      }
    } catch (err) {
      console.warn(`Gemini Lyria exception (tentative ${attempt + 1}/${GEMINI_RETRIES}):`, err);
    }
  }

  return null;
}

async function callVertexLyria(projectId: string, location: string, token: string, prompt: string): Promise<LyriaResult | null> {
  try {
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/lyria-002:predict`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ prompt }],
      }),
    });

    if (!resp.ok) {
      console.warn(`Vertex Lyria HTTP ${resp.status}:`, await resp.text());
      return null;
    }

    const data = await resp.json();
    const bytesBase64 = data?.predictions?.[0]?.bytesBase64Encoded || data?.predictions?.[0]?.audioContent;
    if (bytesBase64) {
      console.warn("Fallback Vertex (wav) utilisé.");
      return { audioBase64: bytesBase64, mimeType: "audio/wav" };
    }
  } catch (err) {
    console.warn("Vertex Lyria exception:", err);
  }

  return null;
}

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const admin = getSupabaseAdmin();
  let songIdForError: string | null = null;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { songId, paidRegeneration } = await req.json();
    if (!songId) return jsonResponse({ error: "songId requis" }, 400);
    songIdForError = songId;

    const { data: song, error: fetchErr } = await admin
      .from("songs")
      .select("*")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !song) return jsonResponse({ error: "Chanson introuvable dans la base" }, 404);

    const sensitiveTopic = detectSensitiveTopic(song.brief, song.occasion, song.recipient_name, song.lyrics);
    if (sensitiveTopic) {
      await admin.from("songs").update({
        status: "failed",
        failure_reason: sensitiveTopicMessage(sensitiveTopic),
      }).eq("id", songId);
      return jsonResponse({ error: sensitiveTopicMessage(sensitiveTopic) }, 422);
    }

    const isPaidRegen = paidRegeneration && song.preview_audio_path;
    let creditConsumed = isPaidRegen;

    if (!isPaidRegen) {
      const { data: profile } = await admin
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      const userCredits = profile?.credits ?? 0;

      if (userCredits > 0) {
        const { data: consumed, error: rpcErr } = await admin.rpc("consume_profile_credit", {
          p_user_id: user.id,
        });
        if (rpcErr) throw rpcErr;
        if (!consumed) {
          return jsonResponse({ error: "Impossible de consommer le crédit. Veuillez réessayer." }, 500);
        }
        creditConsumed = true;
      } else {
        // Extrait gratuit : UNE seule fois a vie. On compte toutes les
        // chansons deja composees (music_provider renseigne).
        const { count: lifetimeCount } = await admin
          .from("songs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("music_provider", "is", null);

        if ((lifetimeCount ?? 0) >= FREE_LIFETIME_GENERATIONS) {
          return jsonResponse(
            { error: "Votre extrait gratuit a déjà été utilisé. Achetez des crédits pour créer vos chansons complètes." },
            429
          );
        }
      }
    }

    await admin.from("songs").update({ status: "music_generating", music_provider: "lyria" }).eq("id", songId);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const gcpProject = Deno.env.get("GCP_PROJECT_ID");
    const gcpLocation = Deno.env.get("GCP_LOCATION") ?? "us-central1";
    const vertexToken = Deno.env.get("VERTEX_ACCESS_TOKEN");

    // Instrumental = pas de genre impose (le brief/reference le decrivent).
    let stylePrompt = song.instrumental
      ? ""
      : (STYLE_PROMPTS[song.music_style] ?? STYLE_PROMPTS.chaabi);
    const voicePrompt = VOICE_PROMPTS[song.voice_type] ?? VOICE_PROMPTS.homme;

    // VOIE A (premium Pro/VIP) : si un extrait de reference est attache et
    // que l'utilisateur y a droit, on remplace le style par la description
    // du style de l'extrait (analyse par Gemini). Best-effort : tout echec
    // retombe proprement sur le style choisi.
    if (song.style_ref_path) {
      const entitled = await hasPremiumStyleAccess(admin, user.id);
      if (entitled) {
        // Gemini decrit le style de l'extrait (sert a Lyria ET au champ
        // style de Suno).
        let styleDesc = "";
        if (geminiKey) {
          const { data: refFile } = await admin.storage.from("style-refs").download(song.style_ref_path);
          if (refFile) {
            const bytes = new Uint8Array(await refFile.arrayBuffer());
            const mime = (refFile as any).type || "audio/mpeg";
            styleDesc = (await describeStyleFromAudio(geminiKey, bytes, mime)) || "";
          }
        }

        // VRAIE REPRISE via Suno (audio-conditionne, async) — SEULEMENT si
        // active (SUNO_ENABLED + cle). Sinon on reste sur Lyria ci-dessous.
        if (sunoEnabled() && song.style_ref_mode === "cover" && song.lyrics) {
          try {
            const { data: signed } = await admin.storage.from("style-refs").createSignedUrl(song.style_ref_path, 3600);
            if (signed?.signedUrl) {
              const vg = song.voice_type === "femme" ? "f" : song.voice_type === "homme" ? "m" : undefined;
              const { taskId } = await sunoUploadCover({
                uploadUrl: signed.signedUrl,
                lyrics: song.lyrics,
                style: styleDesc || (STYLE_PROMPTS[song.music_style] ?? ""),
                title: (song.occasion || "Farha").slice(0, 70),
                vocalGender: vg as ("m" | "f" | undefined),
              });
              await admin.from("songs").update({ provider_job_id: taskId, music_provider: "suno" }).eq("id", songId);
              // Async : suno-callback finalisera la chanson (status -> completed).
              return jsonResponse({ status: "generating", provider: "suno" });
            }
          } catch (e) {
            console.error("Suno cover échec, repli sur Lyria:", e);
          }
        }

        // Sinon : on oriente Lyria avec la description du style.
        if (styleDesc) {
          stylePrompt = song.style_ref_mode === "cover"
            ? `Reproduce a song staying as FAITHFUL as possible to this reference: same genre, tempo/BPM, groove, key feel, instrumentation and overall arrangement. ${styleDesc}`
            : `Take clear inspiration from the STYLE of this reference (same genre, mood and instruments) while composing an original song. ${styleDesc}`;
          console.log(`Style de reference (${song.style_ref_mode || "inspire"}) applique pour`, songId);
        }
      }
    }

    const maxDuration = await getUserMaxDuration(admin, user.id);
    const prompt = song.instrumental
      ? buildInstrumentalPrompt(stylePrompt, song.brief, song.occasion, maxDuration)
      : buildMusicPrompt(stylePrompt, voicePrompt, song.lyrics, maxDuration);

    let result: LyriaResult | null = null;
    let geminiBlocked = false;

    if (geminiKey) {
      const geminiResult = await callGeminiLyria(geminiKey, prompt);
      if (geminiResult === "blocked") {
        if (song.instrumental) {
          // Pas de fallback "paroles" pour un instrumental.
          geminiBlocked = true;
        } else {
          console.warn("Lyria blocked original lyrics — retrying with form context only...");
          const fallbackPrompt = buildFallbackPrompt(stylePrompt, voicePrompt, song.occasion, song.recipient_name, song.brief, song.lyrics_fr, maxDuration);
          const retryResult = await callGeminiLyria(geminiKey, fallbackPrompt);
          if (retryResult === "blocked") {
            geminiBlocked = true;
          } else {
            result = retryResult;
            console.warn("Fallback succeeded — Lyria composed its own lyrics from form context.");
          }
        }
      } else {
        result = geminiResult;
      }
    }

    if (!result && !geminiBlocked && gcpProject && vertexToken) {
      result = await callVertexLyria(gcpProject, gcpLocation, vertexToken, prompt);
    }

    if (!result) {
      const message = geminiBlocked
        ? "Le service de composition musicale (Google Lyria) a refusé ce texte. Cela arrive parfois avec des expressions en arabe ou darija mal interprétées par le filtre automatique. Essayez de reformuler certaines expressions ou simplifier le texte."
        : "La composition musicale a échoué. Veuillez réessayer dans quelques instants.";
      throw new Error(message);
    }

    const audioBytes = Uint8Array.from(atob(result.audioBase64), (c) => c.charCodeAt(0));
    const ext = result.mimeType.includes("wav") ? "wav" : "mp3";
    const contentType = result.mimeType.includes("wav") ? "audio/wav" : "audio/mpeg";
    const bytesPerSecond = ext === "mp3" ? 16000 : 192000;

    // Chemins de stockage explicites pour éviter tout chevauchement
    const fullStoragePath = `${user.id}/full_${songId}.${ext}`;
    const previewStoragePath = `${user.id}/preview_${songId}.${ext}`;

    // 1. Sauvegarde du fichier COMPLET (2:30 à 3:00 min) dans song-full
    const { error: fullErr } = await admin.storage
      .from("song-full")
      .upload(fullStoragePath, audioBytes, { contentType, upsert: true });

    if (fullErr) console.warn("Full audio upload note:", fullErr);

    // 2. Sauvegarde de l'EXTRAIT (30s) dans song-previews
    const { bytes: previewBytes } = truncateAudioBytes(audioBytes, ext, PREVIEW_SECONDS);

    const { error: prevErr } = await admin.storage
      .from("song-previews")
      .upload(previewStoragePath, previewBytes, { contentType, upsert: true });

    if (prevErr) console.warn("Preview audio upload note:", prevErr);

    const approxDuration = Math.round(audioBytes.length / bytesPerSecond);
    const imagePath = geminiKey ? await generateAndUploadCover(admin, geminiKey, user.id, songId, song) : null;

    const finalStatus = creditConsumed ? "completed" : "preview_ready";

    const { data: updated, error: updateErr } = await admin
      .from("songs")
      .update({
        status: finalStatus,
        preview_audio_path: previewStoragePath,
        full_audio_path: fullStoragePath,
        duration_seconds: approxDuration > 0 ? approxDuration : maxDuration,
        image_path: imagePath,
      })
      .eq("id", songId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return jsonResponse({ song: updated });
  } catch (err) {
    console.error("Music generation error:", err);
    if (songIdForError) {
      await admin.from("songs").update({ status: "failed", failure_reason: (err as Error).message }).eq("id", songIdForError);
    }
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});