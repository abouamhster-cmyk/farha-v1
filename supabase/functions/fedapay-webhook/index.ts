import { jsonResponse } from "../_shared/cors.ts";
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";

Deno.serve(async (req: Request) => {
  // 1. Lire le corps de la requête envoyé par Fedapay
  const body = await req.json();
  const admin = getSupabaseAdmin();

  // Fedapay envoie un objet transaction dans le corps
  // On récupère la transaction et ses métadonnées
  const transaction = body.transaction;
  
  if (!transaction || !transaction.id) {
    return jsonResponse({ error: "Données de transaction manquantes" }, 400);
  }

  // 2. Extraire l'ID de notre commande interne
  // Rappel : dans create-checkout, on a mis "Commande [orderId]" dans la description
  const description = transaction.description || "";
  const orderId = description.replace("Commande ", "").trim();

  // 3. Vérifier si la transaction est validée
  if (transaction.status === "approved" || transaction.status === "completed") {
    
    // Récupérer la commande pour vérifier si elle n'a pas déjà été traitée
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderErr || !order || order.status === "completed") {
      return jsonResponse({ message: "Commande déjà traitée ou introuvable" }, 200);
    }

    // 4. TRANSACTION RÉUSSIE : Créditer l'utilisateur
    // On met à jour la commande
    await admin
      .from("orders")
      .update({ status: "completed" })
      .eq("id", orderId);

    // On ajoute les crédits au profil de l'utilisateur via un RPC (ou update direct)
    // Ici, nous utilisons une requête SQL pour incrémenter les crédits
    const { error: creditErr } = await admin.rpc("add_profile_credits", {
      p_user_id: order.user_id,
      p_amount: order.songs_granted,
    });

    if (creditErr) {
      console.error("Erreur ajout crédits:", creditErr);
      return jsonResponse({ error: "Erreur lors de l'ajout des crédits" }, 500);
    }

    console.log(`Paiement validé pour Order ${orderId}, crédits ajoutés à ${order.user_id}`);
    return jsonResponse({ status: "success" }, 200);

  } else if (transaction.status === "declined" || transaction.status === "canceled") {
    await admin
      .from("orders")
      .update({ status: "failed" })
      .eq("id", orderId);
      
    return jsonResponse({ status: "transaction_refused" }, 200);
  }

  return jsonResponse({ status: "ignored" }, 200);
});