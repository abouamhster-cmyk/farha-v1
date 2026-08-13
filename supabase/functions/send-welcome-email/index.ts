declare const Deno: any;

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const FROM_EMAIL = "noreply@farha-music.com";
const FROM_NAME = "Farha";

function buildWelcomeHtml(name: string): string {
  const firstName = name.split(" ")[0] || "ami(e)";
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAF5EC;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
  <div style="text-align:center;margin-bottom:28px">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#B83A28;margin-right:8px;vertical-align:middle"></span>
    <span style="font-size:22px;font-weight:700;color:#0A3832;vertical-align:middle">Farha</span>
  </div>

  <div style="background:#fff;border-radius:16px;padding:32px 28px;border:1px solid #e5e0d8">
    <h1 style="font-size:22px;font-weight:700;color:#0A3832;margin:0 0 16px">Bienvenue ${firstName} !</h1>

    <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 20px">
      Votre compte Farha est prêt. Vous pouvez maintenant créer vos chansons en Darija, Raï, Chaâbi et plus.
    </p>

    <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 20px">
      <strong>Comment ça marche :</strong>
    </p>
    <ol style="font-size:14px;line-height:1.8;color:#555;margin:0 0 24px;padding-left:20px">
      <li>Décrivez votre chanson (occasion, destinataire, style)</li>
      <li>Les paroles s'écrivent automatiquement — vous les modifiez librement</li>
      <li>Lancez la musique quand vous êtes satisfait</li>
    </ol>

    <div style="text-align:center;margin:28px 0">
      <a href="https://farha-v1.vercel.app/creer" style="display:inline-block;background:#B83A28;color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none">
        Créer ma première chanson
      </a>
    </div>

    <p style="font-size:13px;color:#999;margin:0;text-align:center">
      Les paroles sont gratuites. Vous payez uniquement pour la musique.
    </p>
  </div>

  <div style="text-align:center;margin-top:24px;font-size:12px;color:#aaa">
    <p style="margin:0">© 2026 Farha</p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id requis" }), { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, welcome_email_sent")
      .eq("id", user_id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profil introuvable" }), { status: 404 });
    }

    if (profile.welcome_email_sent) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const { data: authUser } = await admin.auth.admin.getUserById(user_id);
    const email = authUser?.user?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "Email introuvable" }), { status: 404 });
    }

    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY non configurée — email de bienvenue ignoré");
      await admin
        .from("profiles")
        .update({ welcome_email_sent: true })
        .eq("id", user_id);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_api_key" }), { status: 200 });
    }

    const firstName = (profile.full_name || "").split(" ")[0] || "ami(e)";

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email, name: profile.full_name || "" }],
        subject: `Bienvenue sur Farha, ${firstName} !`,
        htmlContent: buildWelcomeHtml(profile.full_name || ""),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Brevo error:", err);
      return new Response(JSON.stringify({ error: "Échec envoi email", details: err }), { status: 500 });
    }

    await admin
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("id", user_id);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error("send-welcome-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
