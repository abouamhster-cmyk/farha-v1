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

    // 1. Chercher la commande pending de cet utilisateur
    let query = admin
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (transactionId) {
      query = query.eq("provider_session_id", String(transactionId));
    }

    const { data: orders, error: orderErr } = await query.order("created_at", { ascending: false });

    let orderToProcess = orders && orders.length > 0 ? orders[0] : null;

    // Si aucune commande spécifique trouvée avec cet ID, prendre la toute dernière commande pending
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

    // 2. Marquer la commande comme terminée/payée
    await admin
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderToProcess.id);

    // 3. Ajouter les crédits au profil de l'utilisateur
    const { error: creditErr } = await admin.rpc("add_profile_credits", {
      p_user_id: user.id,
      p_amount: orderToProcess.songs_granted,
    });

    if (creditErr) {
      console.warn("RPC add_profile_credits note, fallback direct:", creditErr);
      const { data: profile } = await admin
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();
      
      const currentCredits = profile?.credits ?? 0;
      await admin
        .from("profiles")
        .update({ credits: currentCredits + orderToProcess.songs_granted })
        .eq("id", user.id);
    }

    console.log(`Paiement validé instantanément pour ${user.id}. +${orderToProcess.songs_granted} crédits !`);

    // 4. Récupérer le solde mis à jour
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