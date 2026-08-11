import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:5173";
const COVER_URL_TTL_SECONDS = 6 * 3600;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE_LABEL: Record<string, string> = {
  chaabi: "Chaâbi", rai: "Raï", rap: "Rap/Trap", pop: "Pop orientale",
  acoustique: "Acoustique", gnawa: "Gnawa", oriental: "Orientale classique",
};

function htmlPage(opts: { title: string; description: string; image: string | null; redirectUrl: string }) {
  const { title, description, image, redirectUrl } = opts;
  const imageTag = image
    ? `<meta property="og:image" content="${escapeHtml(image)}">\n    <meta name="twitter:card" content="summary_large_image">`
    : `<meta name="twitter:card" content="summary">`;

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="music.song">
    <meta property="og:url" content="${escapeHtml(redirectUrl)}">
    <meta name="description" content="${escapeHtml(description)}">
    ${imageTag}
    <meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}">
    <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
  </head>
  <body>
    <p>Redirection… <a href="${escapeHtml(redirectUrl)}">Cliquez ici si rien ne se passe</a>.</p>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const songId = url.searchParams.get("songId");

  if (!songId) {
    return new Response(htmlPage({
      title: "Farha — Le Studio de Haute Création Musicale",
      description: "Compositions sur-mesure pour vos réseaux sociaux, vos publicités et vos grands événements.",
      image: null,
      redirectUrl: SITE_URL,
    }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const redirectUrl = `${SITE_URL}/ecouter/${songId}`;

  try {
    const admin = getSupabaseAdmin();
    const { data: song } = await admin
      .from("songs")
      .select("occasion, music_style, recipient_name, image_path, status")
      .eq("id", songId)
      .single();

    if (!song || !["preview_ready", "completed"].includes(song.status)) {
      return new Response(htmlPage({
        title: "Farha — Le Studio de Haute Création Musicale",
        description: "Compositions sur-mesure pour vos réseaux sociaux, vos publicités et vos grands événements.",
        image: null,
        redirectUrl: SITE_URL,
      }), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    let image: string | null = null;
    if (song.image_path) {
      const { data } = await admin.storage
        .from("song-covers")
        .createSignedUrl(song.image_path, COVER_URL_TTL_SECONDS);
      image = data?.signedUrl ?? null;
    }

    const styleLabel = STYLE_LABEL[song.music_style] ?? song.music_style;
    const title = song.recipient_name
      ? `Une création ${styleLabel} pour ${song.recipient_name} 🎵`
      : `Une création ${styleLabel} sur-mesure 🎵`;
    const description = `${song.occasion || "Un projet spécial"} — écoutez la réalisation sur Farha, votre studio créatif audio.`;

    return new Response(htmlPage({ title, description, image, redirectUrl }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error(err);
    return new Response(htmlPage({
      title: "Farha — Le Studio de Haute Création Musicale",
      description: "Compositions sur-mesure pour vos réseaux sociaux, vos publicités et vos grands événements.",
      image: null,
      redirectUrl: SITE_URL,
    }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
});