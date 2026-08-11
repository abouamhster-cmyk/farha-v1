import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

const VEO_MODEL = "veo-3.1-fast-generate-preview";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { songId, aspectRatio = "9:16" } = await req.json();
    if (!songId) return jsonResponse({ error: "songId requis" }, 400);

    const admin = getSupabaseAdmin();

    const { data: song, error: fetchErr } = await admin
      .from("songs")
      .select("*")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !song) return jsonResponse({ error: "Chanson introuvable" }, 404);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY manquante dans les secrets Supabase." }, 500);
    }

    // Marquer la vidéo en cours
    await admin.from("songs").update({ video_status: "generating" }).eq("id", songId);

    // Prompt artistique professionnel pour Google Veo 3.1
    const prompt = `Cinematic music video clip for TikTok and Instagram Reels. Format: ${aspectRatio}. Music style: ${song.music_style}. Occasion: ${song.occasion || "Celebration"}. Story/Brief: ${song.brief}. High quality, cinematic lighting, vibrant colors, smooth professional camera motion.`;

    console.log(`Lancement Google Veo 3.1 (${aspectRatio}) pour la chanson ${songId}...`);

    const startResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${VEO_MODEL}:predictLongRunning?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { 
            aspectRatio: aspectRatio, 
            durationSeconds: 8 
          },
        }),
      }
    );

    if (!startResp.ok) {
      const errTxt = await startResp.text();
      console.error("Veo 3.1 API error:", errTxt);
      await admin.from("songs").update({ video_status: "failed" }).eq("id", songId);
      return jsonResponse({ error: "Erreur de communication avec Google Veo 3.1." }, 500);
    }

    const startData = await startResp.json();
    const operationName = startData?.name;

    if (!operationName) {
      await admin.from("songs").update({ video_status: "failed" }).eq("id", songId);
      return jsonResponse({ error: "Impossible d'initialiser le rendu vidéo." }, 500);
    }

    // Enregistrer le nom de l'opération pour le suivi asynchrone
    await admin.from("songs").update({ video_operation_name: operationName }).eq("id", songId);

    return jsonResponse({ status: "generating", operationName });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});