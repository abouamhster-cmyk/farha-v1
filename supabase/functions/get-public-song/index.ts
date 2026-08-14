// GET /get-public-song?songId=xxx
//
// Endpoint PUBLIC (pas de vérification d'auth) au service de la page de
// partage (/ecouter/:songId côté frontend, voir share-meta pour l'aperçu
// WhatsApp/Instagram). Volontairement minimal : ne renvoie QUE ce qui est
// sûr à montrer à n'importe qui connaissant l'URL — jamais le fichier
// complet payant, jamais le brief brut (peut contenir des détails privés
// sur le destinataire), jamais l'identité du créateur.
//
// La chanson reste "non listée" : sans lien direct, elle est introuvable
// (pas d'index public des chansons). Le songId (UUID) n'est pas devinable.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const PREVIEW_URL_TTL_SECONDS = 3600;
const COVER_URL_TTL_SECONDS = 3600;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const url = new URL(req.url);
    const songId = url.searchParams.get("songId");
    if (!songId) return jsonResponse({ error: "songId requis" }, 400);

    const admin = getSupabaseAdmin();

    const { data: song, error } = await admin
      .from("songs")
      .select(
        "id, user_id, occasion, music_style, dialect, recipient_name, preview_audio_path, full_audio_path, image_path, status, created_at"
      )
      .eq("id", songId)
      .single();

    // Statut "draft"/"failed"/en cours de génération : rien à montrer
    // publiquement, on renvoie 404 comme si la chanson n'existait pas.
    if (error || !song || !["preview_ready", "completed", "purchased"].includes(song.status)) {
      return jsonResponse({ error: "Chanson introuvable ou pas encore prête." }, 404);
    }

    // On partage la MUSIQUE COMPLÈTE si elle est débloquée (completed /
    // purchased) — le créateur a payé et choisit de la partager. Sinon,
    // repli sur l'extrait 30s (chanson pas encore débloquée).
    const isFull = ["completed", "purchased"].includes(song.status) && !!song.full_audio_path;

    let audioUrl: string | null = null;
    if (isFull) {
      const { data } = await admin.storage
        .from("song-full")
        .createSignedUrl(song.full_audio_path, PREVIEW_URL_TTL_SECONDS);
      audioUrl = data?.signedUrl ?? null;
    }
    // Repli extrait si pas de complet dispo
    if (!audioUrl && song.preview_audio_path) {
      const { data } = await admin.storage
        .from("song-previews")
        .createSignedUrl(song.preview_audio_path, PREVIEW_URL_TTL_SECONDS);
      audioUrl = data?.signedUrl ?? null;
    }

    let coverUrl: string | null = null;
    if (song.image_path) {
      const { data } = await admin.storage
        .from("song-covers")
        .createSignedUrl(song.image_path, COVER_URL_TTL_SECONDS);
      coverUrl = data?.signedUrl ?? null;
    }

    return jsonResponse({
      song: {
        id: song.id,
        occasion: song.occasion,
        musicStyle: song.music_style,
        dialect: song.dialect,
        recipientName: song.recipient_name,
        createdAt: song.created_at,
        audioUrl,
        // conserve previewUrl pour compat éventuelle, pointe sur le même flux
        previewUrl: audioUrl,
        isFull,
        coverUrl,
      },
    });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
