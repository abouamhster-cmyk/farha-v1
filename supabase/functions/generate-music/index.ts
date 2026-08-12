declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";
import { generateAndUploadCover } from "../_shared/coverImage.ts";
import { detectSensitiveTopic, sensitiveTopicMessage } from "../_shared/moderation.ts";
import { truncateAudioBytes } from "../_shared/audioTruncate.ts";

const PREVIEW_SECONDS = 30;
const GEMINI_RETRIES = 2;
const FREE_GENERATIONS_PER_DAY = Number(Deno.env.get("FREE_GENERATIONS_PER_DAY") ?? "1");
const DEFAULT_FREE_DURATION = 60;

const STYLE_PROMPTS: Record<string, string> = {
  chaabi: "Traditional and festive Moroccan/Algerian chaabi music. Bendir frame drum, derbouka, traditional percussion, handclaps. Festive party atmosphere, 120 BPM.",
  rai: "Modern Algerian and Maghrebi Rai music. Synthesizer pads, accordion, club danceable groove, 120 BPM.",
  rap: "Modern Maghrebi Rap and Trap Darija beat. Heavy deep 808 sub-bass, fast trap hi-hats, autotuned urban vocals, 135 BPM.",
  pop: "Contemporary Arabic and Maghrebi pop music. Smooth modern production with soft beat, catchy synths, 105 BPM.",
  acoustique: "Intimate acoustic song. Soft nylon guitar, gentle finger-picking, 80 BPM.",
  gnawa: "Gnawa fusion music. Guembri bassline, metallic qraqeb castanets, 115 BPM.",
  oriental: "Classical Arabic oriental and Andalusian music. Rich violin section, oud, qanun, 95 BPM.",
  mezwed: "Traditional Tunisian mezwed music. Mezwed bagpipe lead, festive wedding-party percussion, 125 BPM.",
  amazigh: "Amazigh (Berber) traditional music. Bendir drums, collective call-and-response chanting, hypnotic tribal rhythm, 110 BPM.",
  rnb: "Modern R&B/Afrobeat fusion with Maghrebi influence. Smooth groove, warm bassline, soulful production, 95 BPM.",
};

const VOICE_PROMPTS: Record<string, string> = {
  homme: "Solo male vocals.",
  femme: "Solo female vocals.",
  duo: "Duet: male and female vocals alternating/answering each other.",
  choeurs: "Group choir vocals, several voices singing together.",
  enfant: "Child's singing voice, innocent and joyful tone.",
};

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
          return jsonResponse({ error: "Erreur lors de la consommation du crédit." }, 500);
        }
        creditConsumed = true;
      } else {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: recentCount } = await admin
          .from("songs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .not("music_provider", "is", null)
          .gte("created_at", since);

        if ((recentCount ?? 0) >= FREE_GENERATIONS_PER_DAY) {
          return jsonResponse(
            { error: "Limite de création gratuite atteinte pour aujourd'hui. Achetez des crédits pour continuer sans limite." },
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

    const stylePrompt = STYLE_PROMPTS[song.music_style] ?? STYLE_PROMPTS.chaabi;
    const voicePrompt = VOICE_PROMPTS[song.voice_type] ?? VOICE_PROMPTS.homme;
    const maxDuration = await getUserMaxDuration(admin, user.id);
    const prompt = buildMusicPrompt(stylePrompt, voicePrompt, song.lyrics, maxDuration);

    let result: LyriaResult | null = null;
    let geminiBlocked = false;

    if (geminiKey) {
      const geminiResult = await callGeminiLyria(geminiKey, prompt);
      if (geminiResult === "blocked") {
        geminiBlocked = true;
      } else {
        result = geminiResult;
      }
    }

    if (!result && !geminiBlocked && gcpProject && vertexToken) {
      result = await callVertexLyria(gcpProject, gcpLocation, vertexToken, prompt);
    }

    if (!result) {
      const message = geminiBlocked
        ? "Ce contenu a été refusé par notre studio créatif (sujet sensible ou inapproprié). Modifiez votre description ou vos paroles et réessayer."
        : "L'API de composition musicale Google n'a pas pu traiter la demande. Vérifiez vos crédits ou votre clé GEMINI_API_KEY.";
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