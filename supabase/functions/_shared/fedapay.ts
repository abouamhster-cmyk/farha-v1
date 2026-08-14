declare const Deno: any;

// Utilitaires partagés Fedapay : source unique de vérité pour le statut
// réel d'une transaction. On ne fait jamais confiance au corps d'une
// requête entrante (callback front ou webhook) : on interroge Fedapay.

export const FEDAPAY_PAID_STATUSES = ["approved", "transferred", "completed"];
export const FEDAPAY_FAILED_STATUSES = ["declined", "canceled", "cancelled", "refunded", "expired"];

export function fedapayBase(): string {
  const isLive = Deno.env.get("FEDAPAY_ENV") === "live";
  return isLive ? "https://api.fedapay.com/v1" : "https://sandbox-api.fedapay.com/v1";
}

// Renvoie le statut reel (minuscules) d'une transaction, ou null si
// Fedapay est injoignable / transaction introuvable.
export async function getFedapayStatus(transactionId: string): Promise<string | null> {
  const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY");
  if (!secretKey) throw new Error("FEDAPAY_SECRET_KEY manquante dans les secrets.");

  const resp = await fetch(`${fedapayBase()}/transactions/${transactionId}`, {
    headers: {
      "Authorization": `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("Erreur lecture transaction Fedapay:", data);
    return null;
  }

  const tx = data["v1/transaction"] || data.transaction || data;
  const status = tx?.status;
  return status ? String(status).toLowerCase() : null;
}

export function isPaid(status: string | null): boolean {
  return !!status && FEDAPAY_PAID_STATUSES.includes(status);
}

export function isFailed(status: string | null): boolean {
  return !!status && FEDAPAY_FAILED_STATUSES.includes(status);
}
