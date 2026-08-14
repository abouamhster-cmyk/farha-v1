// POST /create-variant  { songId, copyLyrics?: boolean }
//
// Cree une NOUVELLE version (variante) d'une chanson : duplique le brief
// (et optionnellement les paroles) dans un nouveau brouillon, en gardant
// l'originale intacte. La nouvelle ligne est reliee a la lignee via
// root_song_id / parent_song_id / version_number.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { songId, copyLyrics = true } = await req.json().catch(() => ({}));
    if (!songId) return jsonResponse({ error: "songId requis" }, 400);

    const admin = getSupabaseAdmin();

    // Source (doit appartenir a l'utilisateur)
    const { data: source, error: srcErr } = await admin
      .from("songs")
      .select("*")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (srcErr || !source) return jsonResponse({ error: "Chanson introuvable." }, 404);

    const rootId = source.root_song_id || source.id;

    // Prochain numero de version dans la lignee
    const { data: lineage } = await admin
      .from("songs")
      .select("version_number")
      .eq("user_id", user.id)
      .or(`root_song_id.eq.${rootId},id.eq.${rootId}`)
      .order("version_number", { ascending: false })
      .limit(1);

    const nextVersion = (lineage && lineage[0]?.version_number ? lineage[0].version_number : 1) + 1;

    const willCopyLyrics = copyLyrics && !!source.lyrics;

    const { data: variant, error: insErr } = await admin
      .from("songs")
      .insert({
        user_id: user.id,
        dialect: source.dialect,
        music_style: source.music_style,
        voice_type: source.voice_type,
        recipient_name: source.recipient_name,
        occasion: source.occasion,
        brief: source.brief,
        // Paroles copiees (optionnel) -> demarre a l'etape paroles
        lyrics: willCopyLyrics ? source.lyrics : null,
        lyrics_fr: willCopyLyrics ? source.lyrics_fr : null,
        lyrics_version: 0,
        lyrics_history: [],
        // Aucune musique heritée : la variante repart d'un brouillon propre
        status: willCopyLyrics ? "lyrics_ready" : "draft",
        // Filiation
        parent_song_id: source.id,
        root_song_id: rootId,
        version_number: nextVersion,
      })
      .select("id, version_number, status")
      .single();

    if (insErr) {
      console.error("create-variant insert error:", insErr);
      return jsonResponse({ error: "Erreur lors de la création de la variante." }, 500);
    }

    return jsonResponse({
      songId: variant.id,
      versionNumber: variant.version_number,
      startStep: willCopyLyrics ? 2 : 1,
    });
  } catch (err) {
    console.error("create-variant error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
