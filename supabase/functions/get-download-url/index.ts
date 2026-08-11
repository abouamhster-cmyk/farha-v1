import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

Deno.serve(async (req) => {
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
      .select("id, user_id, status, full_audio_path, preview_audio_path")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !song) return jsonResponse({ error: "Chanson introuvable dans la base" }, 404);

    // Vérification du statut de déblocage (completed ou purchased)
    const isUnlocked = song.status === "completed" || song.status === "purchased";
    if (!isUnlocked) {
      return jsonResponse({ error: "Débloquez cette chanson pour la télécharger." }, 403);
    }

    const audioPath = song.full_audio_path || song.preview_audio_path;
    if (!audioPath) {
      return jsonResponse({ error: "Fichier audio introuvable." }, 404);
    }

    let signedUrl = null;

    // 1. Essayer le bucket privé song-full en priorité
    const { data: signedFull } = await admin.storage
      .from("song-full")
      .createSignedUrl(audioPath, SIGNED_URL_TTL_SECONDS);

    if (signedFull?.signedUrl) {
      signedUrl = signedFull.signedUrl;
    } else {
      // 2. Fallback sur le bucket song-previews si besoin
      const { data: signedPrev } = await admin.storage
        .from("song-previews")
        .createSignedUrl(audioPath, SIGNED_URL_TTL_SECONDS);

      if (signedPrev?.signedUrl) {
        signedUrl = signedPrev.signedUrl;
      }
    }

    if (!signedUrl) {
      return jsonResponse({ error: "Fichier audio introuvable dans le stockage Supabase." }, 404);
    }

    return jsonResponse({ url: signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS, unlocked: isUnlocked });
  } catch (err) {
    console.error("Get download URL error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});