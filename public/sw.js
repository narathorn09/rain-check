// Handles Web Push only. The app is not cached, so forecasts are always fresh.
// Bump when this file changes; the settings screen shows it to confirm the phone updated.
const SW_VERSION = "4";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Tells any open app window what happened, so the settings screen can show a receipt.
async function report(message) {
  const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of list) c.postMessage({ source: "rain-check-sw", version: SW_VERSION, at: Date.now(), ...message });
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(data.title || "เช็คฝน", {
          body: data.body || "",
          // The server sends a unique tag per message, so each one is its own notification.
          tag: data.tag || `rain-${Date.now()}`,
          renotify: true,
          icon: "/icon-192",
          badge: "/badge-96",
          data: { url: data.url || "/" },
          vibrate: [200, 100, 200],
        });
        await report({ type: "push-shown", title: data.title || "" });
      } catch (err) {
        await report({ type: "push-failed", error: String(err && err.message ? err.message : err) });
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "version?") event.source?.postMessage({ source: "rain-check-sw", type: "version", version: SW_VERSION });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
