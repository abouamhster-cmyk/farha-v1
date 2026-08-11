import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Erreur volontairement bruyante : mieux vaut planter tôt en dev que
  // silencieusement échouer sur chaque appel réseau plus tard.
  console.error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. Copiez .env.example vers .env et remplissez-le."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Petit utilitaire pour appeler les Edge Functions avec le JWT de
// l'utilisateur connecté automatiquement attaché.
export async function callFunction(name, body, method = "POST") {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const url = `${supabaseUrl}/functions/v1/${name}${
    method === "GET" && body
      ? "?" + new URLSearchParams(body).toString()
      : ""
  }`;

  const resp = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json?.error ?? `Erreur ${name} (${resp.status})`);
  }
  return json;
}
