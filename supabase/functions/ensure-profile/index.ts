import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

async function sendWelcomeEmail(admin: ReturnType<typeof getSupabaseAdmin>, userId: string, fullName: string) {
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) return;

    const firstName = (fullName || "").split(" ")[0] || "Créateur";

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY non configurée, email non envoyé");
      await admin.from("profiles").update({ welcome_email_sent: true }).eq("id", userId);
      return;
    }

    const htmlContent = `
      <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#14110F">
        <div style="text-align:center;margin-bottom:28px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#B83A28;margin-right:8px;vertical-align:middle"></span>
          <span style="font-size:24px;font-weight:700;vertical-align:middle">Farha</span>
        </div>
        <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#14110F">Bienvenue ${firstName} !</h1>
        <p style="font-size:15px;line-height:1.6;color:#5C5449;margin:0 0 20px">
          Votre compte Farha est prêt. Vous pouvez maintenant créer des chansons personnalisées en Darija, Raï, Chaâbi et bien d'autres styles.
        </p>
        <p style="font-size:15px;line-height:1.6;color:#5C5449;margin:0 0 24px">
          Vos paroles sont 100% gratuites — payez uniquement pour débloquer l'audio final.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="https://farha-v1.vercel.app/creer"
             style="display:inline-block;background:#B83A28;color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none">
            Créer ma première chanson
          </a>
        </div>
        <p style="font-size:13px;color:#5C5449;text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #E5DCCB">
          L'équipe Farha — Le Studio de Haute Création Musicale
        </p>
      </div>
    `;

    const senderEmail = Deno.env.get("EMAIL_FROM") || "noreply@farha.app";
    const senderName = Deno.env.get("EMAIL_FROM_NAME") || "Farha";

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: fullName || firstName }],
        subject: `Bienvenue sur Farha, ${firstName} !`,
        htmlContent,
      }),
    });

    if (!res.ok) {
      console.error("Brevo error:", await res.text());
      return;
    }

    await admin.from("profiles").update({ welcome_email_sent: true }).eq("id", userId);
    console.log("Welcome email sent to", email);
  } catch (err) {
    console.error("sendWelcomeEmail error:", err);
  }
}

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("profiles")
      .select("id, welcome_email_sent")
      .eq("id", user.id)
      .single();

    if (existing) {
      if (!existing.welcome_email_sent) {
        const meta = user.user_metadata ?? {};
        const fullName = meta.full_name || meta.name || (user.email ? user.email.split("@")[0] : "Utilisateur");
        sendWelcomeEmail(admin, user.id, fullName);
      }
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

    sendWelcomeEmail(admin, user.id, fullName);

    return jsonResponse({ status: "created" });
  } catch (err) {
    console.error("ensure-profile error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
