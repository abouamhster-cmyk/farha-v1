// Droits premium bases sur les commandes payees.
// La musique de reference (Voie A) est reservee aux paliers Pro (pack20)
// et Studio VIP (pack40) : l'utilisateur y a droit s'il a au moins une
// commande PAYEE sur l'un de ces packs.

export const PREMIUM_STYLE_PACKS = ["pack20", "pack40"];

// Limite de (re)generations de PAROLES (gratuites) selon le meilleur plan
// achete. Base (aucun achat / pack4) = 4, puis augmente avec le plan.
const LYRICS_REGEN_LIMITS: Record<string, number> = {
  pack4: 4,
  pack10: 6,
  pack20: 10,
  pack40: 15,
};
const LYRICS_REGEN_BASE = 4;

export async function getLyricsRegenLimit(admin: any, userId: string): Promise<number> {
  if (!userId) return LYRICS_REGEN_BASE;
  const { data } = await admin
    .from("orders")
    .select("pack_id")
    .eq("user_id", userId)
    .eq("status", "paid");
  const owned = new Set((data || []).map((o: any) => o.pack_id));
  if (owned.has("pack40")) return LYRICS_REGEN_LIMITS.pack40;
  if (owned.has("pack20")) return LYRICS_REGEN_LIMITS.pack20;
  if (owned.has("pack10")) return LYRICS_REGEN_LIMITS.pack10;
  if (owned.has("pack4")) return LYRICS_REGEN_LIMITS.pack4;
  return LYRICS_REGEN_BASE;
}

export async function hasPremiumStyleAccess(admin: any, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "paid")
    .in("pack_id", PREMIUM_STYLE_PACKS)
    .limit(1);
  if (error) {
    console.error("hasPremiumStyleAccess error:", error);
    return false;
  }
  return !!(data && data.length > 0);
}
