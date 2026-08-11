declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
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
      .select("*")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !song) return jsonResponse({ error: "Chanson introuvable dans la base" }, 404);

    // AUTORISER LA RÉGÉNÉRATION POUR TOUS LES STATUTS VALIDES
    if (!["completed", "purchased", "preview_ready"].includes(song.status)) {
      return jsonResponse({ error: "Statut invalide pour la régénération." }, 400);
    }

    // Vérifier et consommer 1 crédit
    const { data: profile } = await admin.from("profiles").select("credits").eq("id", user.id).single();
    if ((profile?.credits ?? 0) <= 0) {
      return jsonResponse({ error: "Crédits insuffisants pour régénérer la musique." }, 402);
    }

    const { data: consumed, error: rpcErr } = await admin.rpc("consume_profile_credit", { p_user_id: user.id });
    if (rpcErr || !consumed) {
      return jsonResponse({ error: "Erreur lors de la consommation du crédit." }, 500);
    }

    await admin.from("songs").update({
      status: "music_generating",
    }).eq("id", songId);

    return jsonResponse({ success: true, songId });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});