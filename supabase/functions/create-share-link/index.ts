import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { songId, shareType, senderName, message, photoPath } = await req.json();
    if (!songId) return jsonResponse({ error: "songId requis" }, 400);

    const admin = getSupabaseAdmin();

    const { data: song, error: songErr } = await admin
      .from("songs")
      .select("id, status, user_id")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (songErr || !song) {
      return jsonResponse({ error: "Chanson introuvable." }, 404);
    }

    if (song.status !== "completed" && song.status !== "purchased") {
      return jsonResponse({ error: "La chanson doit être débloquée pour être partagée." }, 403);
    }

    const { data: shareLink, error: insertErr } = await admin
      .from("share_links")
      .insert({
        song_id: songId,
        user_id: user.id,
        share_type: shareType || "direct",
        sender_name: senderName || null,
        message: message || null,
        photo_path: photoPath || null,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Insert share_links error:", insertErr);
      return jsonResponse({ error: "Erreur lors de la création du lien." }, 500);
    }

    return jsonResponse({ shareId: shareLink.id });
  } catch (err) {
    console.error("create-share-link error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
