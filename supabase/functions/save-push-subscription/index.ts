// POST /save-push-subscription  { subscription, userAgent? }
//
// Enregistre l'abonnement Web Push du createur connecte pour pouvoir lui
// envoyer une notification systeme (meme telephone verrouille) quand un
// destinataire ecoute sa chanson partagee.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const { subscription, userAgent } = await req.json().catch(() => ({}));
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return jsonResponse({ error: "Abonnement invalide" }, 400);
    }

    const admin = getSupabaseAdmin();

    // upsert par endpoint (unique) : un meme appareil ne cree pas de doublon
    const { error } = await admin
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent || null,
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("save-push-subscription error:", error);
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ status: "subscribed" });
  } catch (err) {
    console.error("save-push-subscription exception:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
