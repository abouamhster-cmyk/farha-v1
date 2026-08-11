// POST /unlock-song
// Body: { songId: string }
//
// Consomme 1 crédit (du solde alimenté par les webhooks de paiement) pour
// débloquer le fichier complet d'une chanson précise. Utilise un RPC
// atomique pour éviter qu'un double-clic ne consomme deux crédits.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

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
      .select("id, status, full_audio_path")
      .eq("id", songId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !song) return jsonResponse({ error: "Chanson introuvable" }, 404);

    if (song.status === "completed") {
      return jsonResponse({ error: "Chanson déjà débloquée." }, 409);
    }
    if (song.status !== "preview_ready" || !song.full_audio_path) {
      return jsonResponse({ error: "L'extrait de cette chanson n'est pas encore prêt." }, 409);
    }

    const { data: consumed, error: rpcErr } = await admin.rpc("consume_profile_credit", {
      p_user_id: user.id,
    });
    if (rpcErr) throw rpcErr;

    if (!consumed) {
      return jsonResponse(
        { error: "Aucun crédit disponible. Achetez une formule pour débloquer cette chanson." },
        402
      );
    }

    // Rattache la chanson à la commande la plus ancienne encore créditée,
    // pour garder une traçabilité (utilisé aussi par get-download-url).
    const { data: order } = await admin
      .from("orders")
      .select("id, songs_consumed")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .lt("songs_consumed", "songs_granted")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    const { data: updated, error: updateErr } = await admin
      .from("songs")
      .update({ status: "completed", order_id: order?.id ?? null })
      .eq("id", songId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (order) {
      await admin
        .from("orders")
        .update({ songs_consumed: order.songs_consumed + 1 })
        .eq("id", order.id);
    }

    return jsonResponse({ song: updated });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
