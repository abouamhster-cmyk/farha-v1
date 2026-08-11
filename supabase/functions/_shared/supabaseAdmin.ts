import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Client "admin" : utilise la service_role key, qui CONTOURNE le RLS.
// Ne doit JAMAIS être exposée au frontend — vit uniquement côté Edge
// Function, dans les secrets d'environnement Supabase.
export function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Récupère l'utilisateur authentifié à partir du header Authorization
// (JWT envoyé automatiquement par supabase-js côté client). Permet de
// vérifier que l'appelant est bien propriétaire de la ressource avant
// toute opération sensible.
export async function getAuthedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data, error } = await supabaseAnon.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}
