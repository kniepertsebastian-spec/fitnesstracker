// Loaded into the generated service worker via workbox's `importScripts` — vite-plugin-pwa's
// `generateSW` strategy has no hook for custom event listeners in its config, so this is the
// documented way to add push/notificationclick handling without switching to injectManifest
// (which would mean hand-rolling the precache registration this app already gets for free).

// A notification may only ever lead back into this app. A push payload carrying a foreign
// (`https://evil.example`) or non-http(s) URL (`javascript:`) — or one that doesn't parse — falls
// back to the start page instead of being opened or navigated to.
function sameOriginUrl(rawUrl) {
  if (typeof rawUrl !== "string" || rawUrl === "") return "/";
  try {
    const url = new URL(rawUrl, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}

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
      // Android draws the badge in the status bar using only its alpha channel: the full-colour
      // app icon (opaque square) would show up as a white blob. A transparent, single-colour
      // dumbbell keeps its shape.
      badge: "/icons/badge-72.png",
      data: { url: sameOriginUrl(data.url) },
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
  // Checked again here: notifications shown by an older worker version still carry the URL
  // exactly as the push sent it.
  const url = sameOriginUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          // navigate() rejects for a client this worker doesn't control (includeUncontrolled) —
          // bringing the app to the front is still the right reaction, just without the jump.
          try {
            await client.navigate(url);
          } catch {
            // ignored, see above
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
