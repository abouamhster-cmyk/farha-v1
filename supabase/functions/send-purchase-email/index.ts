declare const Deno: any;

import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const FROM_EMAIL = "noreply@farha-music.com";
const FROM_NAME = "Farha";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function buildPurchaseHtml(name: string, packName: string, credits: number, amount: number, provider: string): string {
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
    <h1 style="font-size:20px;font-weight:700;color:#0A3832;margin:0 0 16px">Merci ${firstName} !</h1>

    <p style="font-size:15px;line-height:1.6;color:#555;margin:0 0 20px">
      Votre achat a bien été confirmé. Vos crédits sont disponibles immédiatement.
    </p>

    <div style="background:#FAF5EC;border-radius:12px;padding:20px;margin:0 0 24px;border:1px solid #e5e0d8">
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr>
          <td style="padding:6px 0;color:#888">Pack</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${packName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888">Crédits ajoutés</td>
          <td style="padding:6px 0;text-align:right;font-weight:700;color:#0A3832">+${credits}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888">Montant</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${formatEuros(amount)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888">Paiement</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;text-transform:capitalize">${provider}</td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="https://farha-v1.vercel.app/credits" style="display:inline-block;background:#0A3832;color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none">
        Voir mes crédits
      </a>
    </div>

    <p style="font-size:13px;color:#999;margin:0;text-align:center">
      Vos crédits n'expirent jamais. Utilisez-les quand vous voulez.
    </p>
  </div>

  <div style="text-align:center;margin-top:24px;font-size:12px;color:#aaa">
    <p style="margin:0">© 2026 Farha</p>
  </div>
</div>
</body>
</html>`;
}

const PACK_NAMES: Record<string, string> = {
  pack4: "Découverte (4 crédits)",
  pack10: "Créateur (10 crédits)",
  pack20: "Pro (20 crédits)",
  pack40: "Studio VIP (40 crédits)",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  try {
    const { user_id, order_id } = await req.json();
    if (!user_id || !order_id) {
      return new Response(JSON.stringify({ error: "user_id et order_id requis" }), { status: 400 });
    }

    if (!BREVO_API_KEY) {
      console.warn("BREVO_API_KEY non configurée — email d'achat ignoré");
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
    }

    const admin = getSupabaseAdmin();

    const [{ data: profile }, { data: order }, { data: authUser }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", user_id).single(),
      admin.from("orders").select("pack_id, songs_granted, amount_cents, provider").eq("id", order_id).single(),
      admin.auth.admin.getUserById(user_id),
    ]);

    const email = authUser?.user?.email;
    if (!email || !profile || !order) {
      return new Response(JSON.stringify({ error: "Données introuvables" }), { status: 404 });
    }

    const packName = PACK_NAMES[order.pack_id] || order.pack_id || "Pack";

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email, name: profile.full_name || "" }],
        subject: `Confirmation d'achat — ${packName}`,
        htmlContent: buildPurchaseHtml(
          profile.full_name || "",
          packName,
          order.songs_granted ?? 0,
          order.amount_cents ?? 0,
          order.provider || "carte"
        ),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Brevo error:", err);
      return new Response(JSON.stringify({ error: "Échec envoi email" }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error("send-purchase-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
