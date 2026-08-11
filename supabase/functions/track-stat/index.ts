// POST /track-stat
// Body: { key: "landing_visits" | "songs_created" | "downloads" | "users_count", amount?: number }
//
// Incrémente un compteur de manière atomique. Appelé côté serveur (ou
// directement depuis le frontend pour les visites, protégé par rate
// limiting Supabase côté edge). Pas de JWT requis pour les visites
// (page publique), requis pour les autres stats sensibles.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const PUBLIC_KEYS = ["landing_visits"]; // les seules clés incrémentables sans auth

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const { key, amount = 1 } = await req.json();
    if (!key) return jsonResponse({ error: "key requis" }, 400);

    // Pour les stats non publiques, on vérifie que l'appel vient bien
    // d'une Edge Function avec service_role (pas d'auth utilisateur
    // requise, on fait confiance à l'appelant interne).
    if (!PUBLIC_KEYS.includes(key) && amount > 0) {
      const authHeader = req.headers.get("x-internal-secret");
      if (authHeader !== Deno.env.get("INTERNAL_SECRET")) {
        return jsonResponse({ error: "Non autorisé" }, 403);
      }
    }

    const admin = getSupabaseAdmin();
    const { data } = await admin.rpc("increment_stat", { p_key: key, p_amount: amount });

    return jsonResponse({ key, value: data });
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
