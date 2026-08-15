declare const Deno: any;

// =====================================================================
// Callback Suno (sunoapi.org) — recoit l'audio termine et finalise la
// chanson. Endpoint PUBLIC (Suno POST ici). Idempotent.
// Rattache la chanson via provider_job_id = task_id.
// =====================================================================
import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = body?.data ?? {};
    const callbackType = payload?.callbackType;
    const taskId = payload?.task_id;

    // On agit uniquement quand tout est termine.
    if (!taskId) return jsonResponse({ received: true });
    if (callbackType && callbackType !== "complete") {
      return jsonResponse({ received: true, stage: callbackType });
    }

    const tracks = Array.isArray(payload?.data) ? payload.data : [];
    const track = tracks[0];
    const audioUrl = track?.audio_url || track?.source_audio_url;
    if (!audioUrl) return jsonResponse({ received: true, note: "no audio yet" });

    const admin = getSupabaseAdmin();

    // Retrouver la chanson par son taskId (stocke a la soumission).
    const { data: song } = await admin
      .from("songs")
      .select("id, user_id, status, provider_job_id")
      .eq("provider_job_id", String(taskId))
      .maybeSingle();

    if (!song) return jsonResponse({ received: true, note: "song not found" });
    if (song.status === "completed" || song.status === "purchased") {
      return jsonResponse({ received: true, duplicate: true });
    }

    // Telecharger l'audio Suno et le stocker dans nos buckets.
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      await admin.from("songs").update({ status: "failed", failure_reason: "Téléchargement audio Suno échoué." }).eq("id", song.id);
      return jsonResponse({ received: true, error: "download failed" }, 200);
    }
    const bytes = new Uint8Array(await audioResp.arrayBuffer());
    const path = `${song.user_id}/${song.id}.mp3`;

    // Full (débloqué : la reprise se fait a la composition avec credit).
    await admin.storage.from("song-full").upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    // Preview (meme fichier) pour l'ecoute et le partage.
    await admin.storage.from("song-previews").upload(path, bytes, { contentType: "audio/mpeg", upsert: true });

    await admin
      .from("songs")
      .update({
        status: "completed",
        full_audio_path: path,
        preview_audio_path: path,
        duration_seconds: track?.duration ? Math.round(track.duration) : null,
      })
      .eq("id", song.id);

    return jsonResponse({ received: true, status: "completed" });
  } catch (err) {
    console.error("suno-callback error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
