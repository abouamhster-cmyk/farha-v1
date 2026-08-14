// POST /track-share-listen  { shareId?, songId }
//
// Endpoint PUBLIC appelé quand le destinataire LANCE la lecture d'une
// chanson partagée. Il enregistre l'écoute et prévient le créateur par
// email (via Brevo), au plus une fois toutes les 24h par lien de partage
// pour ne pas spammer.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const NOTIFY_THROTTLE_MS = 24 * 60 * 60 * 1000; // 24h

async function sendListenEmail(toEmail: string, listenerLabel: string, songTitle: string) {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) {
    console.warn("BREVO_API_KEY absente : notification d'écoute non envoyée");
    return;
  }

  const htmlContent = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#14110F">
      <div style="text-align:center;margin-bottom:24px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#B83A28;margin-right:8px;vertical-align:middle"></span>
        <span style="font-size:22px;font-weight:700;vertical-align:middle">Farha</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 14px;color:#14110F">🎧 Votre chanson vient d'être écoutée !</h1>
      <p style="font-size:15px;line-height:1.6;color:#5C5449;margin:0 0 18px">
        Bonne nouvelle : <strong>${listenerLabel}</strong> vient d'écouter la chanson
        <strong>« ${songTitle} »</strong> que vous avez partagée.
      </p>
      <div style="text-align:center;margin:26px 0">
        <a href="https://farha-v1.vercel.app/tableau-de-bord"
           style="display:inline-block;background:#B83A28;color:#fff;font-weight:700;font-size:15px;padding:13px 30px;border-radius:12px;text-decoration:none">
          Voir mes chansons
        </a>
      </div>
      <p style="font-size:12px;color:#5C5449;text-align:center;margin-top:28px;padding-top:18px;border-top:1px solid #E5DCCB">
        L'équipe Farha — Le Studio de Haute Création Musicale
      </p>
    </div>
  `;

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: Deno.env.get("EMAIL_FROM_NAME") || "Farha",
          email: Deno.env.get("EMAIL_FROM") || "noreply@farha.app",
        },
        to: [{ email: toEmail }],
        subject: "🎧 Votre chanson Farha vient d'être écoutée",
        htmlContent,
      }),
    });
    if (!res.ok) console.error("Brevo listen email error:", await res.text());
  } catch (err) {
    console.error("sendListenEmail exception:", err);
  }
}

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const { shareId, songId } = await req.json().catch(() => ({}));
    if (!songId && !shareId) return jsonResponse({ error: "songId ou shareId requis" }, 400);

    const admin = getSupabaseAdmin();

    // Charger le lien de partage (si fourni) pour le throttle + le nom
    let share: any = null;
    if (shareId) {
      const { data } = await admin
        .from("share_links")
        .select("id, song_id, sender_name, listen_count, first_listened_at, last_notified_at")
        .eq("id", shareId)
        .maybeSingle();
      share = data;
    }

    const resolvedSongId = share?.song_id || songId;
    if (!resolvedSongId) return jsonResponse({ received: true });

    const { data: song } = await admin
      .from("songs")
      .select("id, user_id, occasion, recipient_name")
      .eq("id", resolvedSongId)
      .maybeSingle();

    if (!song) return jsonResponse({ received: true });

    // Enregistrer l'écoute sur le lien de partage (si présent)
    let shouldNotify = false;
    if (share) {
      const now = Date.now();
      const lastNotified = share.last_notified_at ? new Date(share.last_notified_at).getTime() : 0;
      shouldNotify = now - lastNotified > NOTIFY_THROTTLE_MS;

      await admin
        .from("share_links")
        .update({
          listen_count: (share.listen_count ?? 0) + 1,
          first_listened_at: share.first_listened_at ?? new Date().toISOString(),
          ...(shouldNotify ? { last_notified_at: new Date().toISOString() } : {}),
        })
        .eq("id", share.id);
    } else {
      // Pas de lien de partage : on ne notifie pas (évite le spam sur les
      // liens directs sans dédicace), on accuse juste réception.
      return jsonResponse({ received: true });
    }

    if (shouldNotify) {
      const { data: authUser } = await admin.auth.admin.getUserById(song.user_id);
      const ownerEmail = authUser?.user?.email;
      if (ownerEmail) {
        const listenerLabel = share.sender_name
          ? `Le destinataire de ${share.sender_name}`
          : (song.recipient_name || "Quelqu'un");
        const songTitle = song.occasion || "votre chanson";
        await sendListenEmail(ownerEmail, listenerLabel, songTitle);
      }
    }

    return jsonResponse({ received: true, notified: shouldNotify });
  } catch (err) {
    console.error("track-share-listen error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
