import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { getFedapayStatus, isPaid, isFailed } from "../_shared/fedapay.ts";

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const admin = getSupabaseAdmin();

    // Fedapay envoie un objet transaction dans le corps.
    const transaction = body?.transaction ?? body?.entity ?? body?.data;
    if (!transaction || !transaction.id) {
      return jsonResponse({ error: "Données de transaction manquantes" }, 400);
    }

    // SECURITE : on ne fait PAS confiance au statut envoyé dans le corps
    // (un tiers pourrait forger un POST). On redemande le VRAI statut a
    // Fedapay avec l'ID de la transaction. Impossible a falsifier sans
    // une vraie transaction approuvée liée a une commande existante.
    const realStatus = await getFedapayStatus(String(transaction.id));
    if (realStatus === null) {
      // Fedapay injoignable : on demande a Fedapay de re-livrer plus tard.
      return jsonResponse({ error: "Statut Fedapay non verifiable" }, 502);
    }

    // Retrouver notre commande interne. On la lie par la reference stockee
    // a la creation (provider_session_id), avec repli sur la description.
    let order = null;
    {
      const { data } = await admin
        .from("orders")
        .select("id, status, user_id, songs_granted")
        .eq("provider", "fedapay")
        .eq("provider_session_id", String(transaction.id))
        .maybeSingle();
      order = data;
    }
    if (!order) {
      const description = transaction.description || "";
      const orderId = description.replace("Commande ", "").trim();
      if (orderId) {
        const { data } = await admin
          .from("orders")
          .select("id, status, user_id, songs_granted")
          .eq("id", orderId)
          .eq("provider", "fedapay")
          .maybeSingle();
        order = data;
      }
    }

    if (!order) {
      console.error("Commande introuvable pour Fedapay tx", transaction.id);
      return jsonResponse({ received: true });
    }

    // Echec definitif -> marquer failed.
    if (isFailed(realStatus)) {
      await admin.from("orders").update({ status: "failed" }).eq("id", order.id).eq("status", "pending");
      return jsonResponse({ status: "transaction_refused" }, 200);
    }

    // Pas encore payé -> on ignore (Fedapay renverra a l'approbation).
    if (!isPaid(realStatus)) {
      return jsonResponse({ status: "ignored", realStatus }, 200);
    }

    if (order.status !== "pending") {
      return jsonResponse({ received: true, duplicate: true });
    }

    // Transition atomique pending -> paid (garantit un credit unique).
    const { data: claimed } = await admin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_event_id: String(transaction.id) })
      .eq("id", order.id)
      .eq("status", "pending")
      .select();

    if (!claimed || claimed.length === 0) {
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

    console.log(`Paiement Fedapay confirmé (webhook) Order ${order.id} -> ${order.user_id}`);
    return jsonResponse({ status: "success" }, 200);
  } catch (err) {
    console.error("fedapay-webhook error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
