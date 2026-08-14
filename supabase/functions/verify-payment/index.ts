declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";
import { getFedapayStatus, isPaid, isFailed } from "../_shared/fedapay.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { transactionId } = await req.json().catch(() => ({}));
    const admin = getSupabaseAdmin();

    // 1. Retrouver la commande concernee (toujours limitee a l'utilisateur).
    let orderToProcess = null;

    if (transactionId) {
      const { data } = await admin
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .eq("provider_session_id", String(transactionId))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      orderToProcess = data;
    }

    if (!orderToProcess) {
      // Sinon, la derniere commande en attente de cet utilisateur.
      const { data } = await admin
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      orderToProcess = data;
    }

    if (!orderToProcess) {
      return jsonResponse({ success: false, status: "no_order", message: "Aucune commande à valider." }, 200);
    }

    // Si le webhook a deja credite cette commande, ne rien refaire.
    if (orderToProcess.status === "paid") {
      const { data: prof } = await admin
        .from("profiles").select("credits").eq("id", user.id).single();
      return jsonResponse({
        success: true,
        alreadyProcessed: true,
        creditsGranted: orderToProcess.songs_granted,
        newTotalCredits: prof?.credits ?? 0,
      });
    }

    if (orderToProcess.status === "failed") {
      return jsonResponse({ success: false, status: "failed", message: "Paiement refusé." }, 200);
    }

    // 2. VERIFICATION REELLE cote Fedapay. On ne credite JAMAIS sans ca.
    if (orderToProcess.provider !== "fedapay") {
      return jsonResponse({ success: false, status: "unsupported", message: "Vérification non disponible pour ce moyen de paiement." }, 200);
    }

    const providerRef = orderToProcess.provider_session_id;
    if (!providerRef) {
      return jsonResponse({ success: false, status: "pending", message: "Paiement non finalisé." }, 200);
    }

    const realStatus = await getFedapayStatus(String(providerRef));

    if (realStatus === null) {
      // Impossible de joindre Fedapay : on ne credite pas, on invite a reessayer.
      return jsonResponse({ success: false, status: "unverified", message: "Vérification du paiement impossible pour le moment." }, 200);
    }

    // 3a. Paiement refusé / annulé -> marquer echec, aucun credit.
    if (isFailed(realStatus)) {
      await admin.from("orders").update({ status: "failed" }).eq("id", orderToProcess.id).eq("status", "pending");
      return jsonResponse({ success: false, status: "failed", message: "Paiement refusé ou annulé." }, 200);
    }

    // 3b. Toujours en attente (l'utilisateur a fermé sans payer) -> aucun credit.
    if (!isPaid(realStatus)) {
      return jsonResponse({ success: false, status: "pending", message: "Paiement non finalisé. Aucun crédit ajouté." }, 200);
    }

    // 4. Paiement CONFIRMÉ par Fedapay. Transition atomique pending -> paid.
    //    Le guard .eq("status","pending") garantit qu'on ne credite qu'une
    //    seule fois, meme si le webhook passe en meme temps.
    const { data: claimed } = await admin
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        provider_event_id: String(providerRef),
      })
      .eq("id", orderToProcess.id)
      .eq("status", "pending")
      .select();

    if (!claimed || claimed.length === 0) {
      // Le webhook a gagné la course : deja credite. On renvoie le total a jour.
      const { data: prof } = await admin
        .from("profiles").select("credits").eq("id", user.id).single();
      return jsonResponse({
        success: true,
        alreadyProcessed: true,
        creditsGranted: orderToProcess.songs_granted,
        newTotalCredits: prof?.credits ?? 0,
      });
    }

    const { error: creditErr } = await admin.rpc("increment_profile_credits", {
      p_user_id: user.id,
      p_amount: orderToProcess.songs_granted,
    });

    if (creditErr) {
      console.error("Erreur increment_profile_credits:", creditErr);
      return jsonResponse({ error: "Erreur lors de l'ajout des crédits" }, 500);
    }

    const { data: updatedProfile } = await admin
      .from("profiles").select("credits").eq("id", user.id).single();

    console.log(`Paiement Fedapay confirmé pour ${user.id}. +${orderToProcess.songs_granted} crédits`);

    return jsonResponse({
      success: true,
      creditsGranted: orderToProcess.songs_granted,
      newTotalCredits: updatedProfile?.credits ?? 0,
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
