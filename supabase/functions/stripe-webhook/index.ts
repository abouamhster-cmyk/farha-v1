// POST /stripe-webhook  (appelé uniquement par Stripe, jamais par le frontend)
//
// Fiabilité du paiement (cahier des charges §6) : Stripe peut renvoyer le
// même évènement plusieurs fois. On s'appuie sur la contrainte unique
// (provider, provider_event_id) posée dans le schéma : une insertion en
// doublon échoue silencieusement (on la traite alors comme un succès déjà
// traité) plutôt que de créditer deux fois.
import Stripe from "https://esm.sh/stripe@17?target=deno";
import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error("Signature Stripe invalide", err);
    return jsonResponse({ error: "Signature invalide" }, 400);
  }

  const admin = getSupabaseAdmin();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    if (!orderId) {
      console.error("orderId manquant dans les métadonnées de la session Stripe", session.id);
      return jsonResponse({ received: true });
    }

    // On met à jour la commande PENDING créée par create-checkout (au lieu
    // d'en insérer une nouvelle) : évite une commande fantôme qui resterait
    // "pending" pour toujours pendant qu'une deuxième ligne serait créditée.
    const { data: order } = await admin
      .from("orders")
      .select("id, status, user_id, songs_granted")
      .eq("id", orderId)
      .eq("provider", "stripe")
      .single();

    if (!order) {
      console.error("Commande introuvable pour la session Stripe", session.id, orderId);
      return jsonResponse({ received: true });
    }

    if (order.status !== "pending") {
      return jsonResponse({ received: true, duplicate: true });
    }

    // Idempotence dure : provider_event_id = event.id, garanti unique par
    // Stripe. La contrainte unique (provider, provider_event_id) du schéma
    // fait échouer un double UPDATE concurrent sur le même évènement.
    const { error: updateErr } = await admin
      .from("orders")
      .update({
        status: "paid",
        provider_session_id: session.id,
        provider_event_id: event.id,
        amount_cents: session.amount_total ?? undefined,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pending");

    if (updateErr) {
      if (updateErr.code !== "23505") {
        console.error("Erreur mise à jour commande Stripe", updateErr);
        return jsonResponse({ error: updateErr.message }, 500);
      }
      return jsonResponse({ received: true, duplicate: true });
    }

    await admin.rpc("increment_profile_credits", {
      p_user_id: order.user_id,
      p_amount: order.songs_granted,
    });

    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-purchase-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ user_id: order.user_id, order_id: order.id }),
    }).catch((e: any) => console.warn("Email achat (non-bloquant):", e.message));
  }

  return jsonResponse({ received: true });
});
