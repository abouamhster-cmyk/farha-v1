declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const admin = getSupabaseAdmin();
    const userId = user.id;

    const { data: songs } = await admin
      .from("songs")
      .select("id, preview_audio_path, full_audio_path, image_path")
      .eq("user_id", userId);

    if (songs && songs.length > 0) {
      const previewPaths = songs.map(s => s.preview_audio_path).filter(Boolean);
      const fullPaths = songs.map(s => s.full_audio_path).filter(Boolean);
      const imagePaths = songs.map(s => s.image_path).filter(Boolean);

      if (previewPaths.length) await admin.storage.from("song-previews").remove(previewPaths);
      if (fullPaths.length) await admin.storage.from("song-full").remove(fullPaths);
      if (imagePaths.length) await admin.storage.from("song-covers").remove(imagePaths);

      await admin.from("songs").delete().eq("user_id", userId);
    }

    await admin.from("orders").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);

    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("Erreur suppression auth:", authErr);
      return jsonResponse({ error: "Erreur lors de la suppression du compte" }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (err: any) {
    console.error("delete-account error:", err);
    return jsonResponse({ error: err.message }, 500);
  }
});
