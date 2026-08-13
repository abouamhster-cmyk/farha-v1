import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  // 1. Lire le corps de la requête envoyé par Fedapay
  const body = await req.json();
  const admin = getSupabaseAdmin();

  // Fedapay envoie un objet transaction dans le corps
  // On récupère la transaction et ses métadonnées
  const transaction = body.transaction;
  
  if (!transaction || !transaction.id) {
    return jsonResponse({ error: "Données de transaction manquantes" }, 400);
  }

  // 2. Extraire l'ID de notre commande interne
  // Rappel : dans create-checkout, on a mis "Commande [orderId]" dans la description
  const description = transaction.description || "";
  const orderId = description.replace("Commande ", "").trim();

  // 3. Vérifier si la transaction est validée
  if (transaction.status === "approved" || transaction.status === "completed") {
    
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, status, user_id, songs_granted")
      .eq("id", orderId)
      .eq("provider", "fedapay")
      .single();

    if (orderErr || !order) {
      console.error("Commande introuvable pour Fedapay", orderId);
      return jsonResponse({ received: true });
    }

    if (order.status !== "pending") {
      return jsonResponse({ received: true, duplicate: true });
    }

    const { error: updateErr } = await admin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_event_id: String(transaction.id) })
      .eq("id", orderId)
      .eq("status", "pending");

    if (updateErr) {
      if (updateErr.code !== "23505") {
        console.error("Erreur mise à jour commande Fedapay", updateErr);
        return jsonResponse({ error: updateErr.message }, 500);
      }
      return jsonResponse({ received: true, duplicate: true });
    }

    const { error: creditErr } = await admin.rpc("increment_profile_credits", {
      p_user_id: order.user_id,
      p_amount: order.songs_granted,
    });

    if (creditErr) {
      console.error("Erreur ajout crédits:", creditErr);
      return jsonResponse({ error: "Erreur lors de l'ajout des crédits" }, 500);
    }

    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-purchase-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ user_id: order.user_id, order_id: order.id }),
    }).catch((e: any) => console.warn("Email achat (non-bloquant):", e.message));

    return jsonResponse({ status: "success" }, 200);

  } else if (transaction.status === "declined" || transaction.status === "canceled") {
    await admin
      .from("orders")
      .update({ status: "failed" })
      .eq("id", orderId);
      
    return jsonResponse({ status: "transaction_refused" }, 200);
  }

  return jsonResponse({ status: "ignored" }, 200);
});