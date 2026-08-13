declare const Deno: any;

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  try {
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authHeader?.includes(expectedKey)) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drafts, error: fetchErr } = await admin
      .from("songs")
      .select("id, user_id, preview_audio_path, full_audio_path, image_path")
      .in("status", ["draft", "lyrics_ready", "lyrics_generating"])
      .lt("created_at", cutoff);

    if (fetchErr) {
      console.error("Erreur fetch brouillons:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    if (!drafts || drafts.length === 0) {
      return new Response(JSON.stringify({ cleaned: 0 }), { status: 200 });
    }

    let cleaned = 0;

    for (const song of drafts) {
      const filesToDelete: { bucket: string; path: string }[] = [];

      if (song.preview_audio_path) {
        filesToDelete.push({ bucket: "song-previews", path: song.preview_audio_path });
      }
      if (song.full_audio_path) {
        filesToDelete.push({ bucket: "song-full", path: song.full_audio_path });
      }
      if (song.image_path) {
        filesToDelete.push({ bucket: "song-covers", path: song.image_path });
      }

      for (const { bucket, path } of filesToDelete) {
        await admin.storage.from(bucket).remove([path]);
      }

      const { error: delErr } = await admin.from("songs").delete().eq("id", song.id);
      if (!delErr) cleaned++;
    }

    console.log(`Cleanup: ${cleaned}/${drafts.length} brouillons supprimés`);
    return new Response(JSON.stringify({ cleaned, total: drafts.length }), { status: 200 });
  } catch (err: any) {
    console.error("cleanup-drafts error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
