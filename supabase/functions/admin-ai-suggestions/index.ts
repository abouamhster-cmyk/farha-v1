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
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalUsersRes,
      newUsers30dRes,
      newUsers7dRes,
      totalSongsRes,
      completedSongsRes,
      failedSongsRes,
      paidOrdersRes,
      revenue30dRes,
      revenue60dRes,
      shareLinksRes,
      personalizedSharesRes,
      dialectsRes,
      stylesRes,
      packsRes,
      ordersAllRes,
    ] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),
      admin.from("profiles").select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),
      admin.from("songs").select("id", { count: "exact", head: true }),
      admin.from("songs").select("id", { count: "exact", head: true })
        .in("status", ["completed", "purchased"]),
      admin.from("songs").select("id", { count: "exact", head: true })
        .eq("status", "failed"),
      admin.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "paid"),
      admin.from("orders").select("amount_cents").eq("status", "paid")
        .gte("created_at", thirtyDaysAgo.toISOString()),
      admin.from("orders").select("amount_cents").eq("status", "paid")
        .gte("created_at", sixtyDaysAgo.toISOString())
        .lt("created_at", thirtyDaysAgo.toISOString()),
      admin.from("share_links").select("id", { count: "exact", head: true }),
      admin.from("share_links").select("id", { count: "exact", head: true })
        .eq("share_type", "personalized"),
      admin.from("songs").select("dialect"),
      admin.from("songs").select("music_style"),
      admin.from("orders").select("pack_id").eq("status", "paid"),
      admin.from("orders").select("status"),
    ]);

    const totalUsers = totalUsersRes.count ?? 0;
    const newUsers30d = newUsers30dRes.count ?? 0;
    const newUsers7d = newUsers7dRes.count ?? 0;
    const totalSongs = totalSongsRes.count ?? 0;
    const completedSongs = completedSongsRes.count ?? 0;
    const failedSongs = failedSongsRes.count ?? 0;
    const paidOrders = paidOrdersRes.count ?? 0;
    const totalShares = shareLinksRes.count ?? 0;
    const personalizedShares = personalizedSharesRes.count ?? 0;

    const sum = (rows: { amount_cents: number }[] | null) =>
      (rows ?? []).reduce((s, r) => s + r.amount_cents, 0);
    const rev30d = sum(revenue30dRes.data);
    const rev60d = sum(revenue60dRes.data);

    const countBy = (rows: Record<string, string>[] | null, key: string) => {
      const map: Record<string, number> = {};
      for (const r of rows ?? []) map[r[key] || "inconnu"] = (map[r[key] || "inconnu"] || 0) + 1;
      return map;
    };

    const dialectMap = countBy(dialectsRes.data, "dialect");
    const styleMap = countBy(stylesRes.data, "music_style");
    const packMap = countBy(packsRes.data, "pack_id");

    const pendingOrders = (ordersAllRes.data ?? []).filter(o => o.status === "pending").length;
    const failedOrders = (ordersAllRes.data ?? []).filter(o => o.status === "failed").length;

    const suggestions: { type: string; title: string; detail: string; priority: string }[] = [];

    // Growth analysis
    const weeklyGrowthRate = totalUsers > 0 ? (newUsers7d / totalUsers) * 100 : 0;
    if (weeklyGrowthRate > 5) {
      suggestions.push({
        type: "growth",
        title: "Croissance forte cette semaine",
        detail: `+${newUsers7d} nouveaux utilisateurs en 7 jours (${weeklyGrowthRate.toFixed(1)}% de la base). C'est le moment d'investir dans la rétention : email de bienvenue personnalisé, tutoriel guidé pour la première chanson, notification push après 48h d'inactivité.`,
        priority: "high",
      });
    } else if (newUsers7d === 0 && totalUsers > 0) {
      suggestions.push({
        type: "growth",
        title: "Aucune inscription cette semaine",
        detail: "Aucun nouvel utilisateur en 7 jours. Actions recommandées : (1) Campagne pub ciblée sur les réseaux sociaux maghrébins, (2) Proposer un essai gratuit plus visible sur la landing page, (3) Partenariats avec des influenceurs musique/culture.",
        priority: "critical",
      });
    }

    // Revenue analysis
    if (rev60d > 0) {
      const revenueGrowth = ((rev30d - rev60d) / rev60d) * 100;
      if (revenueGrowth > 20) {
        suggestions.push({
          type: "revenue",
          title: "Revenus en hausse de " + revenueGrowth.toFixed(0) + "%",
          detail: `${(rev30d / 100).toFixed(2)}€ ce mois vs ${(rev60d / 100).toFixed(2)}€ le mois précédent. Continuez sur cette lancée. Envisagez d'introduire un pack premium plus cher avec des fonctionnalités exclusives (vidéo, voix personnalisée).`,
          priority: "medium",
        });
      } else if (revenueGrowth < -20) {
        suggestions.push({
          type: "revenue",
          title: "Baisse des revenus de " + Math.abs(revenueGrowth).toFixed(0) + "%",
          detail: `Chute de ${(rev60d / 100).toFixed(2)}€ à ${(rev30d / 100).toFixed(2)}€. Pistes : (1) Offre flash -30% sur le pack Populaire, (2) Relance email des utilisateurs avec des crédits non utilisés, (3) A/B test sur la page tarifs.`,
          priority: "critical",
        });
      }
    }

    // Conversion funnel
    const conversionRate = totalUsers > 0 ? (paidOrders / totalUsers) * 100 : 0;
    if (conversionRate < 2 && totalUsers > 10) {
      suggestions.push({
        type: "conversion",
        title: "Taux de conversion faible (" + conversionRate.toFixed(1) + "%)",
        detail: `Seulement ${paidOrders} achats sur ${totalUsers} inscrits. Recommandations : (1) Simplifier le parcours d'achat, (2) Ajouter des témoignages sur la page tarifs, (3) Offrir le premier crédit gratuit à l'inscription, (4) Popup de sortie avec une offre spéciale.`,
        priority: "critical",
      });
    } else if (conversionRate > 10) {
      suggestions.push({
        type: "conversion",
        title: "Excellent taux de conversion (" + conversionRate.toFixed(1) + "%)",
        detail: "Le produit convertit bien. Concentrez vos efforts sur l'acquisition (SEO, pub, partenariats) plutôt que sur l'optimisation du tunnel de vente.",
        priority: "low",
      });
    }

    // Song completion rate
    if (totalSongs > 0) {
      const completionRate = (completedSongs / totalSongs) * 100;
      const failRate = (failedSongs / totalSongs) * 100;
      if (failRate > 15) {
        suggestions.push({
          type: "quality",
          title: `${failRate.toFixed(0)}% des chansons échouent`,
          detail: `${failedSongs} chansons en erreur sur ${totalSongs}. Vérifiez les logs de génération (Suno/Lyria). Si c'est un problème récurrent, ajoutez un retry automatique ou un fallback vers l'autre provider.`,
          priority: "critical",
        });
      }
      if (completionRate < 30 && totalSongs > 5) {
        suggestions.push({
          type: "engagement",
          title: "Beaucoup de chansons non finalisées",
          detail: `Seulement ${completionRate.toFixed(0)}% des chansons sont complétées. Les utilisateurs abandonnent le processus. Simplifiez les étapes ou envoyez un rappel email quand une chanson reste en "preview_ready" plus de 24h.`,
          priority: "high",
        });
      }
    }

    // Popular styles insight
    const topStyle = Object.entries(styleMap).sort((a, b) => b[1] - a[1])[0];
    const topDialect = Object.entries(dialectMap).sort((a, b) => b[1] - a[1])[0];
    if (topStyle && topDialect) {
      suggestions.push({
        type: "product",
        title: "Tendances musicales",
        detail: `Style le plus demandé : ${topStyle[0]} (${topStyle[1]} chansons). Dialecte favori : ${topDialect[0]} (${topDialect[1]} chansons). Mettez en avant ces options dans le formulaire de création et dans vos pubs. Envisagez d'ajouter des exemples audio pour ces styles populaires.`,
        priority: "medium",
      });
    }

    // Share feature usage
    if (totalShares > 0) {
      const shareRate = personalizedShares > 0 ? ((personalizedShares / totalShares) * 100).toFixed(0) : "0";
      suggestions.push({
        type: "viral",
        title: "Partage : " + totalShares + " liens créés",
        detail: `${shareRate}% sont personnalisés. ${personalizedShares > totalShares * 0.3 ? "Le partage personnalisé fonctionne bien — mettez-le en avant dans les emails post-achat." : "Peu de partages personnalisés. Ajoutez un prompt après chaque achat : 'Dédiez cette chanson à quelqu'un !' avec un CTA vers le partage personnalisé."}`,
        priority: "medium",
      });
    } else if (completedSongs > 0) {
      suggestions.push({
        type: "viral",
        title: "Aucun partage détecté",
        detail: "Les utilisateurs ne partagent pas leurs chansons. Ajoutez un bouton de partage plus visible après le déblocage, avec un message encourageant : 'Faites découvrir votre création !'",
        priority: "high",
      });
    }

    // Pack preference
    const topPack = Object.entries(packMap).sort((a, b) => b[1] - a[1])[0];
    if (topPack) {
      suggestions.push({
        type: "pricing",
        title: "Pack le plus vendu : " + topPack[0],
        detail: `${topPack[1]} ventes. ${topPack[0] === "pack4" ? "Les utilisateurs préfèrent le pack le moins cher. Testez un micro-pack à 1.99€ (2 crédits) pour baisser la barrière d'entrée, ou ajoutez un bonus au pack10 pour encourager l'upsell." : topPack[0] === "pack40" ? "Les power users achètent le pack VIP. Envisagez un abonnement mensuel illimité pour les fidéliser." : "Bonne distribution. Testez une réduction de -15% sur le pack supérieur pour encourager l'upgrade."}`,
        priority: "medium",
      });
    }

    // Payment failures
    if (pendingOrders > 5 || failedOrders > 3) {
      suggestions.push({
        type: "payment",
        title: `${pendingOrders} paiements en attente, ${failedOrders} échoués`,
        detail: "Un nombre élevé de paiements non finalisés indique un problème dans le tunnel de paiement Fedapay. Vérifiez : (1) Le callback URL est-il correct ? (2) Le webhook reçoit-il les événements ? (3) Ajoutez un email de relance pour les paiements abandonnés.",
        priority: pendingOrders > 10 ? "critical" : "high",
      });
    }

    // Advertising cost suggestion
    if (totalUsers > 0 && paidOrders > 0) {
      const arpu = rev30d / totalUsers;
      suggestions.push({
        type: "ads",
        title: "Budget pub recommandé",
        detail: `ARPU mensuel : ${(arpu / 100).toFixed(2)}€. Avec un taux de conversion de ${conversionRate.toFixed(1)}%, votre CPA (coût par acquisition) max devrait être ~${(arpu * 3 / 100).toFixed(2)}€ pour un ROI positif sur 3 mois. Pour Facebook/Instagram Ads ciblant la diaspora maghrébine, comptez 0.5-2€ par clic. Budget test recommandé : 10-20€/jour pendant 2 semaines.`,
        priority: "high",
      });
    }

    return jsonResponse({ suggestions });
  } catch (err) {
    console.error("admin-ai-suggestions error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
