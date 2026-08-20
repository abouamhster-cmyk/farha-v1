// GET /get-vapid-key  ->  { key: <VAPID_PUBLIC_KEY> }
//
// Sert la cle PUBLIQUE VAPID depuis le serveur pour que le frontend s'abonne
// TOUJOURS avec la meme cle que celle utilisee cote serveur pour signer les
// notifications (VAPID_PRIVATE_KEY). Cela elimine la cause n1 d'echec du Web
// Push : une cle publique codee en dur dans le frontend qui ne correspond plus
// au secret serveur (rotation, placeholder) -> erreur 403 silencieuse.
//
// La cle publique n'est pas un secret : elle est destinee a etre exposee.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve((req: Request) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const key = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  if (!key) return jsonResponse({ error: "VAPID_PUBLIC_KEY non configuree" }, 500);
  return jsonResponse({ key });
});
