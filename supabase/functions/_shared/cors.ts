const ALLOWED_ORIGINS = [
  "https://farha-v1.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
];

let _origin = "";

function getAllowedOrigin(): string {
  return ALLOWED_ORIGINS.includes(_origin) ? _origin : ALLOWED_ORIGINS[0];
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function handleOptions(req: Request): Response | null {
  _origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": getAllowedOrigin(),
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      },
    });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": getAllowedOrigin(),
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Content-Type": "application/json",
    },
  });
}
