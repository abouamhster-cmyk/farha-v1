// POST /paypal-webhook (appelé uniquement par PayPal)
//
// Vérifie la signature via l'API de vérification de webhook de PayPal,
// puis applique la même logique d'idempotence que Stripe (contrainte
// unique (provider, provider_event_id)).
import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const PAYPAL_API_BASE =
  Deno.env.get("PAYPAL_ENV") === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPaypalAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
  const resp = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await resp.json();
  return data.access_token;
}

async function verifyWebhookSignature(req: Request, rawBody: string) {
  const accessToken = await getPaypalAccessToken();
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID")!;

  const verification = {
    auth_algo: req.headers.get("paypal-auth-algo"),
    cert_url: req.headers.get("paypal-cert-url"),
    transmission_id: req.headers.get("paypal-transmission-id"),
    transmission_sig: req.headers.get("paypal-transmission-sig"),
    transmission_time: req.headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  };

  const resp = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(verification),
  });
  const data = await resp.json();
  return data.verification_status === "SUCCESS";
}

Deno.serve(async (req) => {
  const rawBody = await req.text();

  const isValid = await verifyWebhookSignature(req, rawBody);
  if (!isValid) {
    console.error("Signature PayPal invalide");
    return jsonResponse({ error: "Signature invalide" }, 400);
  }

  const event = JSON.parse(rawBody);
  const admin = getSupabaseAdmin();

  if (event.event_type === "CHECKOUT.ORDER.APPROVED" || event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const resource = event.resource;
    // create-checkout envoie notre orderId interne dans purchase_units[0].custom_id
    // (voir create-checkout/index.ts → createPaypalSession).
    const orderId = resource?.custom_id ?? resource?.purchase_units?.[0]?.custom_id;

    if (!orderId) {
      console.error("custom_id (orderId) manquant sur la ressource PayPal", resource?.id);
      return jsonResponse({ received: true });
    }

    // On met à jour la commande PENDING créée par create-checkout (au lieu
    // d'en insérer une nouvelle) : évite une commande fantôme qui resterait
    // "pending" pour toujours pendant qu'une deuxième ligne serait créditée.
    const { data: order } = await admin
      .from("orders")
      .select("id, status, user_id, songs_granted")
      .eq("id", orderId)
      .eq("provider", "paypal")
      .single();

    if (!order) {
      console.error("Commande introuvable pour la ressource PayPal", resource?.id, orderId);
      return jsonResponse({ received: true });
    }

    if (order.status !== "pending") {
      return jsonResponse({ received: true, duplicate: true });
    }

    const { error: updateErr } = await admin
      .from("orders")
      .update({
        status: "paid",
        provider_session_id: resource.id,
        provider_event_id: event.id, // id d'évènement PayPal, unique par webhook
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pending");

    if (updateErr) {
      if (updateErr.code !== "23505") {
        console.error("Erreur mise à jour commande PayPal", updateErr);
        return jsonResponse({ error: updateErr.message }, 500);
      }
      return jsonResponse({ received: true, duplicate: true });
    }

    await admin.rpc("increment_profile_credits", { p_user_id: order.user_id, p_amount: order.songs_granted });
  }

  return jsonResponse({ received: true });
});
