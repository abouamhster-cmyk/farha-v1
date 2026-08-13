declare const Deno: any;

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

const ADMIN_EMAILS = ["abouamhster@gmail.com"];

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);
    if (!ADMIN_EMAILS.includes(user.email ?? "")) {
      return jsonResponse({ error: "Accès refusé" }, 403);
    }

    const admin = getSupabaseAdmin();

    const [
      { count: totalUsers },
      { count: totalSongs },
      { data: orders },
      { data: recentUsers },
      { data: recentSongs },
      { data: errorSongs },
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("songs").select("*", { count: "exact", head: true }),
      admin.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      admin.from("profiles").select("id, full_name, avatar_url, credits, created_at").order("created_at", { ascending: false }).limit(20),
      admin.from("songs").select("id, recipient_name, occasion, status, music_style, created_at").order("created_at", { ascending: false }).limit(20),
      admin.from("songs").select("id, recipient_name, status, failure_reason, created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(10),
    ]);

    const allOrders = orders ?? [];
    const paidOrders = allOrders.filter((o: any) => o.status === "paid");
    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + (o.amount_cents ?? 0), 0);
    const totalCreditsGranted = paidOrders.reduce((sum: number, o: any) => sum + (o.songs_granted ?? 0), 0);

    const pendingOrders = allOrders.filter((o: any) => o.status === "pending").length;
    const failedOrders = allOrders.filter((o: any) => o.status === "failed").length;

    const providerBreakdown: Record<string, number> = {};
    for (const o of paidOrders) {
      const p = o.provider ?? "unknown";
      providerBreakdown[p] = (providerBreakdown[p] ?? 0) + (o.amount_cents ?? 0);
    }

    return jsonResponse({
      totalUsers: totalUsers ?? 0,
      totalSongs: totalSongs ?? 0,
      totalRevenue,
      totalCreditsGranted,
      paidOrders: paidOrders.length,
      pendingOrders,
      failedOrders,
      providerBreakdown,
      recentOrders: allOrders.slice(0, 15),
      recentUsers: recentUsers ?? [],
      recentSongs: recentSongs ?? [],
      errorSongs: errorSongs ?? [],
    });
  } catch (err: any) {
    console.error("admin-stats error:", err);
    return jsonResponse({ error: err.message ?? "Erreur serveur" }, 500);
  }
});
