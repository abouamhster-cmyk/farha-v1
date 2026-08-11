import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getAuthedUser } from "../_shared/supabaseAdmin.ts";

const MODEL = "gemini-3.5-flash";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: "Non authentifie" }, 401);

    const { text, direction, dialect } = await req.json();
    if (!text || !direction) return jsonResponse({ error: "text et direction requis" }, 400);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY manquante");

    const prompt = `${direction}\n\nTexte:\n${text}\n\nReponds UNIQUEMENT avec la traduction, rien d'autre. Pas d'explication, pas de prefixe, pas de balise.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4000 },
        }),
      }
    );

    if (!resp.ok) {
      console.warn(`Translate HTTP ${resp.status}:`, await resp.text());
      return jsonResponse({ error: "Erreur de traduction" }, 502);
    }

    const data = await resp.json();
    const translation = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translation) return jsonResponse({ error: "Traduction vide" }, 502);

    return jsonResponse({ translation });
  } catch (err) {
    console.error("Translation error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
