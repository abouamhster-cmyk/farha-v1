// Droits premium bases sur les commandes payees.
// La musique de reference (Voie A) est reservee aux paliers Pro (pack20)
// et Studio VIP (pack40) : l'utilisateur y a droit s'il a au moins une
// commande PAYEE sur l'un de ces packs.

export const PREMIUM_STYLE_PACKS = ["pack20", "pack40"];

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
