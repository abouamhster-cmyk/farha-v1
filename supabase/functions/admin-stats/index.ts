import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin, getAuthedUser } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifié" }, 401);

    const admin = getSupabaseAdmin();

    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return jsonResponse({ error: "Accès refusé" }, 403);
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      usersRes,
      usersNewRes,
      usersNew7dRes,
      usersTodayRes,
      songsRes,
      songsCompletedRes,
      songsPendingRes,
      songsTodayRes,
      ordersRes,
      ordersPaidRes,
      revenueRes,
      revenue30dRes,
      revenue7dRes,
      revenueTodayRes,
      shareLinksRes,
      sharePersonalizedRes,
      dialectsRes,
      stylesRes,
      packsRes,
      recentUsersRes,
      recentOrdersRes,
      dailySignupsRes,
      dailyRevenueRes,
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),
      admin.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),
      admin.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),
      admin.from("songs").select("id", { count: "exact", head: true }),
      admin.from("songs").select("id", { count: "exact", head: true })
        .in("status", ["completed", "purchased"]),
      admin.from("songs").select("id", { count: "exact", head: true })
        .in("status", ["lyrics_generating", "music_generating"]),
      admin.from("songs").select("id", { count: "exact", head: true })
        .gte("created_at", todayStart),
      admin.from("orders").select("id", { count: "exact", head: true }),
      admin.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "paid"),
      admin.from("orders").select("amount_cents").eq("status", "paid"),
      admin.from("orders").select("amount_cents").eq("status", "paid")
        .gte("created_at", thirtyDaysAgo.toISOString()),
      admin.from("orders").select("amount_cents").eq("status", "paid")
        .gte("created_at", sevenDaysAgo.toISOString()),
      admin.from("orders").select("amount_cents").eq("status", "paid")
        .gte("created_at", todayStart),
      admin.from("share_links").select("id", { count: "exact", head: true }),
      admin.from("share_links").select("id", { count: "exact", head: true })
        .eq("share_type", "personalized"),
      admin.from("songs").select("dialect"),
      admin.from("songs").select("music_style"),
      admin.from("orders").select("pack_id").eq("status", "paid"),
      admin.from("profiles").select("id, full_name, credits, created_at")
        .order("created_at", { ascending: false }).limit(20),
      admin.from("orders").select("id, pack_id, amount_cents, status, provider, created_at, user_id")
        .order("created_at", { ascending: false }).limit(20),
      admin.from("profiles").select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
      admin.from("orders").select("created_at, amount_cents, status")
        .eq("status", "paid")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
    ]);

    const sumCents = (rows: { amount_cents: number }[] | null) =>
      (rows ?? []).reduce((s, r) => s + r.amount_cents, 0);

    const countBy = (rows: Record<string, string>[] | null, key: string) => {
      const map: Record<string, number> = {};
      for (const r of rows ?? []) {
        const v = r[key] || "inconnu";
        map[v] = (map[v] || 0) + 1;
      }
      return Object.entries(map)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    };

    const groupByDay = (rows: { created_at: string }[] | null) => {
      const map: Record<string, number> = {};
      for (const r of rows ?? []) {
        const day = r.created_at.slice(0, 10);
        map[day] = (map[day] || 0) + 1;
      }
      return Object.entries(map).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    };

    const groupRevenueByDay = (rows: { created_at: string; amount_cents: number }[] | null) => {
      const map: Record<string, number> = {};
      for (const r of rows ?? []) {
        const day = r.created_at.slice(0, 10);
        map[day] = (map[day] || 0) + r.amount_cents;
      }
      return Object.entries(map).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
    };

    const totalRevenue = sumCents(revenueRes.data);
    const totalUsers = usersRes.count ?? 0;
    const totalPaidOrders = ordersPaidRes.count ?? 0;
    const conversionRate = totalUsers > 0 ? ((totalPaidOrders / totalUsers) * 100).toFixed(1) : "0";
    const avgOrderValue = totalPaidOrders > 0 ? Math.round(totalRevenue / totalPaidOrders) : 0;

    return jsonResponse({
      overview: {
        totalUsers: totalUsers,
        newUsers30d: usersNewRes.count ?? 0,
        newUsers7d: usersNew7dRes.count ?? 0,
        newUsersToday: usersTodayRes.count ?? 0,
        totalSongs: songsRes.count ?? 0,
        completedSongs: songsCompletedRes.count ?? 0,
        pendingSongs: songsPendingRes.count ?? 0,
        songsToday: songsTodayRes.count ?? 0,
        totalOrders: ordersRes.count ?? 0,
        paidOrders: totalPaidOrders,
        totalRevenueCents: totalRevenue,
        revenue30dCents: sumCents(revenue30dRes.data),
        revenue7dCents: sumCents(revenue7dRes.data),
        revenueTodayCents: sumCents(revenueTodayRes.data),
        conversionRate: parseFloat(conversionRate),
        avgOrderValueCents: avgOrderValue,
        totalShares: shareLinksRes.count ?? 0,
        personalizedShares: sharePersonalizedRes.count ?? 0,
      },
      distributions: {
        dialects: countBy(dialectsRes.data, "dialect"),
        styles: countBy(stylesRes.data, "music_style"),
        packs: countBy(packsRes.data, "pack_id"),
      },
      trends: {
        dailySignups: groupByDay(dailySignupsRes.data),
        dailyRevenue: groupRevenueByDay(dailyRevenueRes.data),
      },
      recentUsers: recentUsersRes.data ?? [],
      recentOrders: recentOrdersRes.data ?? [],
    });
  } catch (err) {
    console.error("admin-stats error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
