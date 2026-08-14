import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (existing) {
      return jsonResponse({ status: "exists" });
    }

    const meta = user.user_metadata ?? {};
    const fullName =
      meta.full_name ||
      meta.name ||
      [meta.given_name, meta.family_name].filter(Boolean).join(" ").trim() ||
      (user.email ? user.email.split("@")[0] : "Utilisateur");

    const avatarUrl = meta.avatar_url || meta.picture || null;

    const { error: insertErr } = await admin
      .from("profiles")
      .insert({
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl,
      });

    if (insertErr) {
      console.error("ensure-profile insert error:", insertErr);
      return jsonResponse({ error: insertErr.message }, 500);
    }

    return jsonResponse({ status: "created" });
  } catch (err) {
    console.error("ensure-profile error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
