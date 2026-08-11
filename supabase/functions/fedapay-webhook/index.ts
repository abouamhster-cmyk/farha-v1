// POST /fedapay-webhook
// Appelé par Fedapay quand une transaction est approuvée.
// Retrouve la commande PENDING par la référence/description et crédite l'utilisateur.
import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    console.log("Fedapay webhook received:", rawBody.slice(0, 500));

    const event = JSON.parse(rawBody);

    // Fedapay envoie différents formats selon la version
    const eventName = event.name ?? event.event ?? event.type ?? "";
    console.log("Event name:", eventName);

    if (!eventName.includes("approved")) {
      console.log("Event ignoré (pas approved):", eventName);
      return jsonResponse({ received: true, ignored: true });
    }

    const tx = event.entity ?? event.data ?? event.object ?? {};
    const txId = String(tx.id ?? "");
    const txRef = tx.reference ?? "";
    const description = tx.description ?? "";

    console.log("Transaction:", { id: txId, ref: txRef, description, status: tx.status });

    const admin = getSupabaseAdmin();

    // Stratégie 1 : retrouver l'orderId encodé dans la description (format "Farha|<orderId>")
    let orderId: string | null = null;
    if (description.includes("|")) {
      orderId = description.split("|")[1]?.trim();
    }

    let order: any = null;

    if (orderId) {
      // Chercher par orderId direct
      const { data } = await admin.from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("status", "pending")
        .single();
      order = data;
    }

    if (!order) {
      // Stratégie 2 : chercher par provider_session_id (reference Fedapay)
      const { data } = await admin.from("orders")
        .select("*")
        .eq("provider", "fedapay")
        .eq("provider_session_id", txRef)
        .eq("status", "pending")
        .single();
      order = data;
    }

    if (!order) {
      // Stratégie 3 : chercher par provider_session_id = txId
      const { data } = await admin.from("orders")
        .select("*")
        .eq("provider", "fedapay")
        .eq("provider_session_id", txId)
        .eq("status", "pending")
        .single();
      order = data;
    }

    if (!order) {
      console.error("Aucune commande pending trouvée pour tx:", { txId, txRef, orderId });
      return jsonResponse({ received: true, error: "Order not found" });
    }

    console.log("Order trouvée:", order.id, "user:", order.user_id);

    // Idempotence : vérifier que la commande est toujours pending
    if (order.status !== "pending") {
      console.log("Commande déjà traitée:", order.id);
      return jsonResponse({ received: true, duplicate: true });
    }

    // Marquer la commande comme payée
    const { error: updateErr } = await admin.from("orders").update({
      status: "paid",
      provider_event_id: `fedapay_${txId}_${eventName}`,
      paid_at: new Date().toISOString(),
    }).eq("id", order.id).eq("status", "pending"); // double-check status pour idempotence

    if (updateErr) {
      console.error("Erreur update order:", updateErr);
      return jsonResponse({ received: true, error: updateErr.message });
    }

    // Créditer l'utilisateur
    await admin.rpc("increment_profile_credits", {
      p_user_id: order.user_id,
      p_amount: order.songs_granted,
    });

    console.log(`SUCCÈS: User ${order.user_id} crédité de ${order.songs_granted} chanson(s)`);

    return jsonResponse({ received: true, credited: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
