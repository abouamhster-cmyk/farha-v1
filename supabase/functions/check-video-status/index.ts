import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { songId } = await req.json();
    const admin = getSupabaseAdmin();

    const { data: song } = await admin.from("songs").select("*").eq("id", songId).eq("user_id", user.id).single();
    if (!song || !song.video_operation_name) return jsonResponse({ status: song?.video_status || "idle" });

    if (song.video_status === "ready") return jsonResponse({ status: "ready", song });

    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;
    const pollResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/${song.video_operation_name}?key=${geminiKey}`);
    
    if (!pollResp.ok) return jsonResponse({ status: "generating" });
    const pollData = await pollResp.json();

    if (!pollData.done) return jsonResponse({ status: "generating" });

    if (pollData.error) {
      await admin.from("songs").update({ video_status: "failed" }).eq("id", songId);
      return jsonResponse({ status: "failed", error: pollData.error.message });
    }

    const videoBase64 = pollData.response?.predictions?.[0]?.bytesBase64Encoded || pollData.response?.generatedVideos?.[0]?.video?.bytesBase64Encoded;
    if (!videoBase64) throw new Error("Données vidéo vides");

    const videoBytes = Uint8Array.from(atob(videoBase64), (c) => c.charCodeAt(0));
    const storagePath = `${user.id}/${songId}.mp4`;

    await admin.storage.from("song-videos").upload(storagePath, videoBytes, { contentType: "video/mp4", upsert: true });

    const { data: updated } = await admin.from("songs").update({ video_path: storagePath, video_status: "ready" }).eq("id", songId).select().single();

    return jsonResponse({ status: "ready", song: updated });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});