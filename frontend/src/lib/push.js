// Client Web Push : enregistrement du service worker, demande de
// permission, abonnement, envoi de l'abonnement au serveur.

import { callFunction } from "./supabaseClient.js";

// Clé publique VAPID (non secrète). Surchargée par l'env si présente.
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BEbXGcmm8Aaft2KMOPho31rVZKX8jROsYDvWwD7Hg90T0Y4Vz85wc17lvuFQG60IwGlVKAcbXxmuzqM4pt_HIYA";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Etat courant : "unsupported" | "denied" | "enabled" | "default"
export async function pushStatus() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "enabled" : "default";
  } catch {
    return "default";
  }
}

export async function enablePush() {
  if (!pushSupported()) {
    throw new Error("Les notifications ne sont pas disponibles sur cet appareil / navigateur.");
  }

  const reg = await navigator.serviceWorker.register("/sw.js");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications refusées. Autorisez-les dans les réglages du navigateur.");
  }

  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await callFunction("save-push-subscription", {
    subscription: sub.toJSON(),
    userAgent: navigator.userAgent,
  });

  return true;
}
