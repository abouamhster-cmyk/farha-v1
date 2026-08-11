declare const Deno: any;

import type { getSupabaseAdmin } from "./supabaseAdmin.ts";

const COVER_STYLE_PROMPTS: Record<string, string> = {
  chaabi: "warm festive Moroccan chaabi party atmosphere, bendir drums, traditional patterns",
  rai: "modern Algerian rai club energy, neon accents, desert-rose color palette",
  rap: "urban Maghrebi trap aesthetic, bold abstract street-art shapes, city night lights",
  pop: "contemporary Arabic pop album art, soft gradients, glossy modern look",
  acoustique: "intimate acoustic warmth, golden hour light, minimalist",
  gnawa: "Gnawa fusion mysticism, guembri and qraqeb motifs, deep indigo and cowrie-shell white",
  oriental: "classical oriental elegance, oud and arabesque zellige patterns, rich jewel tones",
  mezwed: "festive Tunisian mezwed party energy, warm terracotta and desert tones, folk patterns",
  amazigh: "Amazigh/Berber cultural motifs, ochre and turquoise tones, geometric tribal patterns",
  rnb: "modern R&B soulful mood, moody warm gradients, contemporary minimal aesthetic",
};

export async function generateCoverImage(
  geminiKey: string,
  song: { music_style: string; occasion: string | null; recipient_name: string | null; brief: string }
): Promise<{ imageBase64: string; mimeType: string } | null> {
  const styleMood = COVER_STYLE_PROMPTS[song.music_style] ?? COVER_STYLE_PROMPTS.chaabi;
  const occasion = song.occasion || "celebration";
  const prompt = `Professional square album cover art. Mood: ${styleMood}. Occasion: ${occasion}. Context: "${song.brief.slice(0, 200)}". Artistic, vibrant, North African aesthetic, high quality digital illustration. STRICT RULES: no text, no letters, no words, no logos, no watermark anywhere in the image, no realistic depiction of a specific real person.`;

  console.log(`[Pochette IA] 🎨 Début de la génération d'image réelle pour le style: ${song.music_style}...`);

  // 1. TENTATIVE N°1 : GOOGLE IMAGEN 4 (imagen-4.0-fast-generate-001 & imagen-4.0-generate-001)
  const imagenModels = ["imagen-4.0-fast-generate-001", "imagen-4.0-generate-001"];

  for (const modelName of imagenModels) {
    try {
      console.log(`[Pochette IA] 🔄 Essai avec Google Imagen 4 (${modelName})...`);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateImages?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt,
            config: {
              numberOfImages: 1,
              aspectRatio: "1:1",
              outputMimeType: "image/jpeg",
            },
          }),
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        const base64 = data?.generatedImages?.[0]?.image?.imageBytes;
        if (base64) {
          console.log(`[Pochette IA] ✅ Succès Google Imagen 4 (${modelName}) ! (Taille Base64: ${base64.length} caractères)`);
          return { imageBase64: base64, mimeType: "image/jpeg" };
        }
      } else {
        console.warn(`[Pochette IA] ⚠️ Imagen 4 (${modelName}) HTTP ${resp.status}:`, await resp.text());
      }
    } catch (err) {
      console.warn(`[Pochette IA] Exception Imagen 4 (${modelName}):`, err);
    }
  }

  // 2. TENTATIVE N°2 : GEMINI FLASH IMAGE (gemini-3.1-flash-image / gemini-2.5-flash-image)
  const flashImageModels = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];

  for (const modelName of flashImageModels) {
    try {
      console.log(`[Pochette IA] 🔄 Essai avec Gemini Flash Image (${modelName})...`);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE"] },
          }),
        }
      );

      if (!resp.ok) continue;

      const data = await resp.json();
      const parts = data?.candidates?.[0]?.content?.parts;
      if (!parts) continue;

      for (const part of parts) {
        if (part.inlineData?.data) {
          console.log(`[Pochette IA] ✅ Succès Gemini Flash Image (${modelName}) !`);
          return { imageBase64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "image/jpeg" };
        }
      }
    } catch (err) {
      console.warn(`[Pochette IA] Échec ${modelName}:`, err);
    }
  }

  console.error("[Pochette IA] ❌ Toutes les tentatives de génération d'image réelle ont échoué.");
  return null;
}

export async function generateAndUploadCover(
  admin: ReturnType<typeof getSupabaseAdmin>,
  geminiKey: string,
  userId: string,
  storagePathBase: string,
  song: { music_style: string; occasion: string | null; recipient_name: string | null; brief: string }
): Promise<string | null> {
  try {
    const cover = await generateCoverImage(geminiKey, song);
    if (!cover) {
      console.error(`[Pochette IA] Impossible de créer l'image réelle pour la chanson ${storagePathBase}`);
      return null;
    }

    const coverBytes = Uint8Array.from(atob(cover.imageBase64), (c) => c.charCodeAt(0));
    const coverExt = cover.mimeType.includes("png") ? "png" : "jpg";
    const coverStoragePath = `${userId}/${storagePathBase}.${coverExt}`;

    console.log(`[Pochette IA] 📤 Upload de l'image réelle (${coverBytes.length} octets) dans le bucket 'song-covers'...`);

    const { error: uploadErr } = await admin.storage
      .from("song-covers")
      .upload(coverStoragePath, coverBytes, { contentType: cover.mimeType, upsert: true });

    if (uploadErr) {
      console.error("[Pochette IA] ❌ Erreur Upload Supabase Storage:", uploadErr);
      return null;
    }

    console.log(`[Pochette IA] 🎉 Image réelle enregistrée avec succès : ${coverStoragePath}`);
    return coverStoragePath;
  } catch (err) {
    console.error(`[Pochette IA] Exception globale pour ${storagePathBase}:`, err);
    return null;
  }
}