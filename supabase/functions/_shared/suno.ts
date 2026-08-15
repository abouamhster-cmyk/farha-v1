declare const Deno: any;

// =====================================================================
// Client Suno (sunoapi.org) — VRAIE reprise audio-conditionnee (Voie B).
// PRET A BRANCHER mais DESACTIVE par defaut : tant que SUNO_ENABLED n'est
// pas "true" et que SUNO_API_KEY est absent, rien ne part vers Suno et
// l'app reste 100% sur Lyria.
//
// Secrets a definir cote Supabase pour activer :
//   SUNO_API_KEY   : cle Bearer sunoapi.org
//   SUNO_ENABLED   : "true" pour activer le routage Suno
//   SUNO_MODEL     : (optionnel) modele, defaut "V4_5ALL"
//   SUNO_CALLBACK_URL : (optionnel) URL publique de suno-callback ;
//                       sinon deduite de SUPABASE_URL.
// =====================================================================

const SUNO_BASE = "https://api.sunoapi.org";

export function sunoEnabled(): boolean {
  return Deno.env.get("SUNO_ENABLED") === "true" && !!Deno.env.get("SUNO_API_KEY");
}

export function sunoModel(): string {
  return Deno.env.get("SUNO_MODEL") || "V4_5ALL";
}

export function sunoCallbackUrl(): string {
  const explicit = Deno.env.get("SUNO_CALLBACK_URL");
  if (explicit) return explicit;
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return `${base}/functions/v1/suno-callback`;
}

function headers() {
  return {
    "Authorization": `Bearer ${Deno.env.get("SUNO_API_KEY")}`,
    "Content-Type": "application/json",
  };
}

// Limites Suno (custom mode) — on tronque par securite.
const STYLE_MAX = 900;
const TITLE_MAX = 78;
const PROMPT_MAX = 4800;

function clip(s: string, n: number): string {
  return (s || "").slice(0, n);
}

interface SunoSubmit {
  taskId: string;
}

// Reprise a partir d'un extrait uploade (mode "cover").
// uploadUrl = URL publique (signee) de l'extrait de reference.
export async function sunoUploadCover(opts: {
  uploadUrl: string;
  lyrics: string;
  style: string;
  title: string;
  vocalGender?: "m" | "f";
  audioWeight?: number;   // influence de l'audio de reference (0..1)
  styleWeight?: number;
}): Promise<SunoSubmit> {
  const body = {
    uploadUrl: opts.uploadUrl,
    customMode: true,
    instrumental: false,
    model: sunoModel(),
    callBackUrl: sunoCallbackUrl(),
    prompt: clip(opts.lyrics, PROMPT_MAX),   // paroles exactes chantees
    style: clip(opts.style, STYLE_MAX),
    title: clip(opts.title || "Farha", TITLE_MAX),
    ...(opts.vocalGender ? { vocalGender: opts.vocalGender } : {}),
    audioWeight: opts.audioWeight ?? 0.75,
    styleWeight: opts.styleWeight ?? 0.6,
  };

  const resp = await fetch(`${SUNO_BASE}/api/v1/generate/upload-cover`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.code !== 200 || !data?.data?.taskId) {
    throw new Error(`Suno upload-cover échec: ${data?.msg || resp.status}`);
  }
  return { taskId: data.data.taskId };
}

// Generation classique (texte -> musique) via Suno, au cas ou on veut
// l'utiliser sans extrait de reference.
export async function sunoGenerate(opts: {
  lyrics: string;
  style: string;
  title: string;
  vocalGender?: "m" | "f";
  styleWeight?: number;
}): Promise<SunoSubmit> {
  const body = {
    customMode: true,
    instrumental: false,
    model: sunoModel(),
    callBackUrl: sunoCallbackUrl(),
    prompt: clip(opts.lyrics, PROMPT_MAX),
    style: clip(opts.style, STYLE_MAX),
    title: clip(opts.title || "Farha", TITLE_MAX),
    ...(opts.vocalGender ? { vocalGender: opts.vocalGender } : {}),
    styleWeight: opts.styleWeight ?? 0.6,
  };
  const resp = await fetch(`${SUNO_BASE}/api/v1/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.code !== 200 || !data?.data?.taskId) {
    throw new Error(`Suno generate échec: ${data?.msg || resp.status}`);
  }
  return { taskId: data.data.taskId };
}
