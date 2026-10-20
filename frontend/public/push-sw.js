// Loaded into the generated service worker via workbox's `importScripts` — vite-plugin-pwa's
// `generateSW` strategy has no hook for custom event listeners in its config, so this is the
// documented way to add push/notificationclick handling without switching to injectManifest
// (which would mean hand-rolling the precache registration this app already gets for free).
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Fitnesstracker", body: event.data ? event.data.text() : "" };
  }

  const show = () =>
    self.registration.showNotification(data.title || "Fitnesstracker", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
      // A tagged notification replaces the previous one of the same kind (e.g. "Pause vorbei").
      ...(data.tag ? { tag: data.tag, renotify: true, vibrate: [200, 100, 200] } : {}),
    });

  // The rest-timer push is only for a locked/backgrounded phone — a visible app already rings.
  // (Browsers allow skipping the notification while a page of the origin is visible.)
  event.waitUntil(
    data.skipIfVisible
      ? self.clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((list) => (list.some((c) => c.visibilityState === "visible") ? undefined : show()))
      : show(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
