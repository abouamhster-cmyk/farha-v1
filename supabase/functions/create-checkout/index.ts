// POST /create-checkout
// Body: { packId: "single" | "pack3" | "pack5", provider: "stripe" | "paypal" | "fedapay" }
//
// FLUX CORRIGÉ : on crée d'abord une commande PENDING dans notre base
// avec la référence du provider, puis quand le webhook arrive, on la
// retrouve par cette référence pour créditer.
import Stripe from "https://esm.sh/stripe@17?target=deno";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

async function createStripeSession(userId: string, pack: any, orderId: string) {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("Stripe non configuré.");

  const stripe = new Stripe(secretKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  // metadata.orderId est relu par stripe-webhook au moment de
  // "checkout.session.completed" pour retrouver la commande PENDING et la
  // marquer payée (userId/packId sont déjà sur cette ligne "orders").
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: pack.currency.toLowerCase(),
        unit_amount: pack.price_cents,
        product_data: { name: pack.label },
      },
      quantity: 1,
    }],
    metadata: { userId, packId: pack.id, orderId },
    success_url: `${SITE_URL}/tableau-de-bord?checkout=success`,
    cancel_url: `${SITE_URL}/tarifs?checkout=cancelled`,
  });

  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");

  return { url: session.url, providerRef: session.id };
}

async function createPaypalSession(userId: string, pack: any, orderId: string) {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !secret) throw new Error("PayPal non configuré.");

  const base = Deno.env.get("PAYPAL_ENV") === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

  const tokenResp = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenResp.ok) throw new Error("Impossible de se connecter à PayPal");
  const { access_token } = await tokenResp.json();

  const orderResp = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        custom_id: orderId, // notre order ID interne
        amount: {
          currency_code: pack.currency,
          value: (pack.price_cents / 100).toFixed(2),
        },
        description: pack.label,
      }],
      application_context: {
        return_url: `${SITE_URL}/tableau-de-bord?checkout=success`,
        cancel_url: `${SITE_URL}/tarifs?checkout=cancelled`,
      },
    }),
  });

  if (!orderResp.ok) throw new Error("Erreur PayPal: " + await orderResp.text());
  const order = await orderResp.json();
  return {
    url: order.links?.find((l: any) => l.rel === "approve")?.href,
    providerRef: order.id,
  };
}

async function createFedapaySession(userId: string, pack: any, orderId: string) {
  const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY");
  if (!secretKey) throw new Error("Fedapay non configuré.");

  const base = Deno.env.get("FEDAPAY_ENV") === "live"
    ? "https://api.fedapay.com/v1"
    : "https://sandbox-api.fedapay.com/v1";

  const EUR_TO_XOF = 655.957;
  const amountXOF = Math.round((pack.price_cents / 100) * EUR_TO_XOF);

  const txResp = await fetch(`${base}/transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: `Farha|${orderId}`,  // on encode l'orderId dans la description
      amount: amountXOF,
      currency: { iso: "XOF" },
      callback_url: `${SITE_URL}/tableau-de-bord?checkout=success`,
    }),
  });

  if (!txResp.ok) throw new Error("Erreur Fedapay: " + await txResp.text());
  const txData = await txResp.json();
  const tx = txData["v1/transaction"] ?? txData;

  if (!tx.payment_url) throw new Error("Pas de lien de paiement Fedapay");

  return {
    url: tx.payment_url,
    providerRef: String(tx.reference ?? tx.id),
  };
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { packId, provider } = await req.json();
    if (!packId || !provider) return jsonResponse({ error: "packId et provider requis" }, 400);

    const admin = getSupabaseAdmin();
    const { data: pack, error: packErr } = await admin
      .from("pricing_packs")
      .select("*")
      .eq("id", packId)
      .eq("active", true)
      .single();

    if (packErr || !pack) return jsonResponse({ error: "Formule introuvable" }, 404);

    // 1. Créer une commande PENDING dans notre base AVANT d'appeler le provider
    const { data: order, error: orderErr } = await admin.from("orders").insert({
      user_id: user.id,
      pack_id: packId,
      provider,
      amount_cents: pack.price_cents,
      currency: pack.currency,
      status: "pending",
      songs_granted: pack.song_count,
    }).select().single();

    if (orderErr) throw orderErr;

    // 2. Créer la session chez le provider
    let result: { url: string; providerRef: string };

    if (provider === "stripe") {
      result = await createStripeSession(user.id, pack, order.id);
    } else if (provider === "paypal") {
      result = await createPaypalSession(user.id, pack, order.id);
    } else if (provider === "fedapay") {
      result = await createFedapaySession(user.id, pack, order.id);
    } else {
      return jsonResponse({ error: `Provider "${provider}" non supporté.` }, 400);
    }

    // 3. Sauvegarder la référence du provider sur la commande
    await admin.from("orders").update({
      provider_session_id: result.providerRef,
    }).eq("id", order.id);

    console.log(`Order ${order.id} created for ${provider}, ref: ${result.providerRef}`);

    return jsonResponse({ url: result.url });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
