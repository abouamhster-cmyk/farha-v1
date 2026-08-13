import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

const PHOTO_URL_TTL_SECONDS = 3600;

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("shareId");
    if (!shareId) return jsonResponse({ error: "shareId requis" }, 400);

    const admin = getSupabaseAdmin();

    const { data: share, error } = await admin
      .from("share_links")
      .select("id, song_id, share_type, sender_name, message, photo_path, created_at")
      .eq("id", shareId)
      .single();

    if (error || !share) {
      return jsonResponse({ error: "Lien de partage introuvable." }, 404);
    }

    let photoUrl: string | null = null;
    if (share.photo_path) {
      const { data } = await admin.storage
        .from("share-photos")
        .createSignedUrl(share.photo_path, PHOTO_URL_TTL_SECONDS);
      photoUrl = data?.signedUrl ?? null;
    }

    return jsonResponse({
      share: {
        id: share.id,
        songId: share.song_id,
        shareType: share.share_type,
        senderName: share.sender_name,
        message: share.message,
        photoUrl,
        createdAt: share.created_at,
      },
    });
  } catch (err) {
    console.error("get-share-data error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
