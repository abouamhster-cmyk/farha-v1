import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";
import { rateLimit, getRateLimitKey, rateLimitResponse } from "../_shared/rateLimit.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://farha-v1.vercel.app";

async function createFedapaySession(userId: string, pack: any, orderId: string) {
  const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY");
  if (!secretKey) throw new Error("FEDAPAY_SECRET_KEY manquante dans les secrets.");

  const isLive = Deno.env.get("FEDAPAY_ENV") === "live";
  const base = isLive ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";

  // Conversion EUR -> XOF (taux fixe)
  const EUR_TO_XOF = 655.957;
  const amountXOF = Math.round((pack.price_cents / 100) * EUR_TO_XOF);
  const cleanSiteUrl = SITE_URL.replace(/\/$/, "");
  const callbackUrl = `${cleanSiteUrl}/tableau-de-bord?checkout=success`;

  // Création de la transaction chez Fedapay
  const txResp = await fetch(`${base}/transactions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: `Commande ${orderId}`,
      amount: amountXOF,
      currency: { iso: "XOF" },
      callback_url: callbackUrl,
    }),
  });

  const txData = await txResp.json();

  if (!txResp.ok) {
    console.error("Erreur Fedapay:", txData);
    throw new Error(txData.message || "Erreur création transaction Fedapay");
  }

  // Récupération sous la clé "v1/transaction" de Fedapay
  const tx = txData["v1/transaction"] || txData.transaction || txData;

  const paymentUrl = tx?.payment_url || tx?.checkout_url;
  const txId = tx?.id;

  if (!paymentUrl || !txId) {
    console.error("Paiement Fedapay invalide:", txData);
    throw new Error("Lien de paiement introuvable dans la réponse Fedapay.");
  }

  return { url: paymentUrl, providerRef: String(txId) };
}

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const { allowed, retryAfter } = rateLimit(getRateLimitKey(req, "checkout"), 10, 60_000);
  if (!allowed) return rateLimitResponse(retryAfter);

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

    // Création commande en base
    const { data: order, error: orderErr } = await admin.from("orders").insert({
      user_id: user.id,
      pack_id: packId,
      provider,
      amount_cents: pack.price_cents,
      currency: pack.currency || 'EUR',
      status: "pending",
      songs_granted: pack.song_count,
    }).select().single();

    if (orderErr) throw orderErr;

    let result: { url: string; providerRef: string };

    if (provider === "fedapay") {
      result = await createFedapaySession(user.id, pack, order.id);
    } else {
      return jsonResponse({ error: `Provider "${provider}" non supporté.` }, 400);
    }

    // Mise à jour de la commande avec la réf
    await admin.from("orders").update({
      provider_session_id: result.providerRef,
    }).eq("id", order.id);

    return jsonResponse({ url: result.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});