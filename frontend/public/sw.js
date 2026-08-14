// Service Worker Farha — notifications Web Push.
// Affiche une notification systeme (meme telephone verrouille) quand le
// serveur envoie un message push (ex: un destinataire ecoute la chanson).

// Prise de contrôle immédiate à l'installation/activation.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Handler fetch minimal (réseau direct) : requis par certains navigateurs
// pour considérer l'app comme installable. On ne met rien en cache ici.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || "Farha";
  const options = {
    body: data.body || "",
    tag: data.tag || "farha-notif",
    data: { url: data.url || "/" },
    vibrate: [120, 60, 120],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
