import { handleOptions } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

// Proxy audio streaming : pas d'URL directe vers storage.
// Le fichier transite par la fonction avec headers anti-téléchargement.

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifie" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const songId = url.searchParams.get("songId");
    if (!songId) {
      return new Response(JSON.stringify({ error: "songId requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = getSupabaseAdmin();

    const { data: song, error: fetchErr } = await admin
      .from("songs")
      .select("id, user_id, full_audio_path, preview_audio_path")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !song) {
      return new Response(JSON.stringify({ error: "Chanson introuvable" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const path = song.full_audio_path || song.preview_audio_path;
    if (!path) {
      return new Response(JSON.stringify({ error: "Fichier audio introuvable" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: dlErr } = await admin.storage
      .from("song-full")
      .download(path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Fichier introuvable" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isWav = path.endsWith(".wav");
    const contentType = isWav ? "audio/wav" : "audio/mpeg";

    console.log(`Streaming ${path} (${fileData.byteLength} bytes, ${contentType})`);

    return new Response(fileData, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileData.size ?? fileData.byteLength ?? 0),
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Accept-Ranges": "none",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Expose-Headers": "Content-Length",
      },
    });
  } catch (err) {
    console.error("Stream error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
