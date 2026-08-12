declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { transactionId } = await req.json();
    const admin = getSupabaseAdmin();

    let query = admin
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (transactionId) {
      query = query.eq("provider_session_id", String(transactionId));
    }

    const { data: orders } = await query.order("created_at", { ascending: false });

    let orderToProcess = orders && orders.length > 0 ? orders[0] : null;

    if (!orderToProcess) {
      const { data: latestPending } = await admin
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      orderToProcess = latestPending;
    }

    if (!orderToProcess) {
      return jsonResponse({ message: "Aucune commande en attente à valider." }, 200);
    }

    await admin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderToProcess.id);

    const { error: creditErr } = await admin.rpc("increment_profile_credits", {
      p_user_id: user.id,
      p_amount: orderToProcess.songs_granted,
    });

    if (creditErr) {
      console.error("Erreur increment_profile_credits:", creditErr);
      return jsonResponse({ error: "Erreur lors de l'ajout des crédits" }, 500);
    }

    console.log(`Paiement validé pour ${user.id}. +${orderToProcess.songs_granted} crédits`);

    const { data: updatedProfile } = await admin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    return jsonResponse({
      success: true,
      creditsGranted: orderToProcess.songs_granted,
      newTotalCredits: updatedProfile?.credits ?? 0
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
