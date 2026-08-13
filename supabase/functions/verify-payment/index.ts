// supabase/functions/verify-payment/index.ts

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

    // 1. Récupérer la commande en attente
    let query = admin
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (transactionId) {
      query = query.eq("provider_session_id", String(transactionId));
    }

    const { data: orders } = await query.order("created_at", { ascending: false });

    if (!orders || orders.length === 0) {
      return jsonResponse({
        success: false,
        message: "Aucune commande en attente.",
        status: "not_found"
      }, 200);
    }

    const order = orders[0];

    // 2. VÉRIFIER LE STATUT RÉEL CHEZ FEDAPAY
    if (order.provider === "fedapay") {
      const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY");
      if (!secretKey) {
        return jsonResponse({ error: "Configuration Fedapay manquante" }, 500);
      }

      const isLive = Deno.env.get("FEDAPAY_ENV") === "live";
      const base = isLive ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
      const txId = order.provider_session_id;

      if (!txId) {
        return jsonResponse({
          success: false,
          message: "ID de transaction manquant.",
          status: "invalid"
        }, 200);
      }

      // Appel API Fedapay pour vérifier le statut réel
      const checkResp = await fetch(`${base}/transactions/${txId}`, {
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!checkResp.ok) {
        console.error("Erreur vérification Fedapay:", await checkResp.text());
        return jsonResponse({
          success: false,
          message: "Impossible de vérifier le statut du paiement. Veuillez réessayer dans quelques instants.",
          status: "error"
        }, 200);
      }

      const checkData = await checkResp.json();
      const transaction = checkData["v1/transaction"] || checkData.transaction || checkData;

      // Statut réel de la transaction
      const realStatus = transaction.status;

      if (realStatus === "approved" || realStatus === "completed") {
        // ✅ Paiement confirmé - on crédite
        const { error: updateErr } = await admin
          .from("orders")
          .update({
            status: "paid",
            provider_event_id: String(transaction.id),
            paid_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "pending");

        if (updateErr) {
          console.error("Erreur mise à jour commande:", updateErr);
          return jsonResponse({ error: updateErr.message }, 500);
        }

        const { error: creditErr } = await admin.rpc("increment_profile_credits", {
          p_user_id: user.id,
          p_amount: order.songs_granted,
        });

        if (creditErr) {
          console.error("Erreur ajout crédits:", creditErr);
          return jsonResponse({ error: "Erreur lors de l'ajout des crédits" }, 500);
        }

        const { data: profile } = await admin
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

        return jsonResponse({
          success: true,
          creditsGranted: order.songs_granted,
          newTotalCredits: profile?.credits ?? 0,
          status: "paid"
        });

      } else if (realStatus === "pending") {
        // ⏳ En attente - pas encore payé
        return jsonResponse({
          success: false,
          message: "Votre paiement est encore en attente de confirmation. Revenez dans quelques instants.",
          status: "pending"
        }, 200);

      } else if (realStatus === "canceled") {
        // ❌ Annulé par l'utilisateur
        await admin
          .from("orders")
          .update({
            status: "failed",
            failure_reason: "Transaction annulée par l'utilisateur"
          })
          .eq("id", order.id);

        return jsonResponse({
          success: false,
          message: "Le paiement a été annulé. Vous pouvez réessayer.",
          status: "canceled"
        }, 200);

      } else {
        // ❌ Échoué, expiré, etc.
        await admin
          .from("orders")
          .update({
            status: "failed",
            failure_reason: `Transaction ${realStatus}`
          })
          .eq("id", order.id);

        return jsonResponse({
          success: false,
          message: `Le paiement n'a pas abouti (statut: ${realStatus}). Veuillez réessayer.`,
          status: realStatus
        }, 200);
      }
    }

    // Pour PayPal
    if (order.provider === "paypal") {
      const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
      const secret = Deno.env.get("PAYPAL_CLIENT_SECRET");
      
      if (!clientId || !secret) {
        return jsonResponse({ error: "Configuration PayPal manquante" }, 500);
      }

      const isLive = Deno.env.get("PAYPAL_ENV") === "live";
      const base = isLive ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const orderId = order.provider_session_id;

      if (!orderId) {
        return jsonResponse({
          success: false,
          message: "ID de commande PayPal manquant.",
          status: "invalid"
        }, 200);
      }

      // Obtenir un token d'accès
      const tokenResp = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${clientId}:${secret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!tokenResp.ok) {
        return jsonResponse({ error: "Erreur authentification PayPal" }, 500);
      }

      const tokenData = await tokenResp.json();
      const accessToken = tokenData.access_token;

      // Vérifier le statut de la commande PayPal
      const orderResp = await fetch(`${base}/v2/checkout/orders/${orderId}`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!orderResp.ok) {
        return jsonResponse({
          success: false,
          message: "Impossible de vérifier le statut du paiement PayPal.",
          status: "error"
        }, 200);
      }

      const paypalOrder = await orderResp.json();
      const realStatus = paypalOrder.status;

      if (realStatus === "COMPLETED" || realStatus === "APPROVED") {
        // ✅ Paiement confirmé
        const { error: updateErr } = await admin
          .from("orders")
          .update({
            status: "paid",
            provider_event_id: paypalOrder.id,
            paid_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "pending");

        if (updateErr) {
          console.error("Erreur mise à jour commande PayPal:", updateErr);
          return jsonResponse({ error: updateErr.message }, 500);
        }

        const { error: creditErr } = await admin.rpc("increment_profile_credits", {
          p_user_id: user.id,
          p_amount: order.songs_granted,
        });

        if (creditErr) {
          console.error("Erreur ajout crédits PayPal:", creditErr);
          return jsonResponse({ error: "Erreur lors de l'ajout des crédits" }, 500);
        }

        const { data: profile } = await admin
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

        return jsonResponse({
          success: true,
          creditsGranted: order.songs_granted,
          newTotalCredits: profile?.credits ?? 0,
          status: "paid"
        });

      } else if (realStatus === "CREATED" || realStatus === "SAVED") {
        return jsonResponse({
          success: false,
          message: "Le paiement PayPal est en cours de validation.",
          status: "pending"
        }, 200);

      } else {
        await admin
          .from("orders")
          .update({
            status: "failed",
            failure_reason: `PayPal ${realStatus}`
          })
          .eq("id", order.id);

        return jsonResponse({
          success: false,
          message: `Le paiement PayPal n'a pas abouti (statut: ${realStatus}).`,
          status: realStatus
        }, 200);
      }
    }

    // Pour Stripe
    if (order.provider === "stripe") {
      const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeSecret) {
        return jsonResponse({ error: "Configuration Stripe manquante" }, 500);
      }

      const sessionId = order.provider_session_id;
      if (!sessionId) {
        return jsonResponse({
          success: false,
          message: "ID de session Stripe manquant.",
          status: "invalid"
        }, 200);
      }

      // Vérifier le statut de la session Stripe
      const stripeResp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: {
          "Authorization": `Bearer ${stripeSecret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!stripeResp.ok) {
        return jsonResponse({
          success: false,
          message: "Impossible de vérifier le statut du paiement Stripe.",
          status: "error"
        }, 200);
      }

      const stripeSession = await stripeResp.json();

      if (stripeSession.payment_status === "paid") {
        // ✅ Paiement confirmé
        const { error: updateErr } = await admin
          .from("orders")
          .update({
            status: "paid",
            provider_event_id: stripeSession.id,
            paid_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "pending");

        if (updateErr) {
          console.error("Erreur mise à jour commande Stripe:", updateErr);
          return jsonResponse({ error: updateErr.message }, 500);
        }

        const { error: creditErr } = await admin.rpc("increment_profile_credits", {
          p_user_id: user.id,
          p_amount: order.songs_granted,
        });

        if (creditErr) {
          console.error("Erreur ajout crédits Stripe:", creditErr);
          return jsonResponse({ error: "Erreur lors de l'ajout des crédits" }, 500);
        }

        const { data: profile } = await admin
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

        return jsonResponse({
          success: true,
          creditsGranted: order.songs_granted,
          newTotalCredits: profile?.credits ?? 0,
          status: "paid"
        });

      } else if (stripeSession.payment_status === "unpaid" || stripeSession.payment_status === "no_payment_required") {
        return jsonResponse({
          success: false,
          message: "Le paiement Stripe est en attente.",
          status: "pending"
        }, 200);

      } else {
        await admin
          .from("orders")
          .update({
            status: "failed",
            failure_reason: `Stripe ${stripeSession.payment_status}`
          })
          .eq("id", order.id);

        return jsonResponse({
          success: false,
          message: `Le paiement Stripe n'a pas abouti (statut: ${stripeSession.payment_status}).`,
          status: stripeSession.payment_status
        }, 200);
      }
    }

    return jsonResponse({
      success: false,
      message: "Fournisseur de paiement non supporté.",
      status: "unsupported"
    }, 200);

  } catch (err) {
    console.error("Verify payment error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});