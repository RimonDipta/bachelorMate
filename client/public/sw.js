/* BachelorMate service worker — makes the app installable and quick to open.
 *
 * - Pages: network first, falling back to the last cached app shell when offline.
 * - Built assets (/assets/*, hashed and immutable), icons and fonts: cache first.
 * - API calls and uploaded files are NEVER cached: they hold personal data and
 *   must always be fresh. The app itself shows an offline notice instead.
 */
const VERSION = "v1";
const SHELL = `bm-shell-${VERSION}`;
const STATIC = `bm-static-${VERSION}`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/favicon.svg", "/theme-init.js", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bm-") && k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isApi = (url) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io/") || url.pathname.startsWith("/uploads/") || url.pathname === "/health";
const isStatic = (url) =>
  url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && isApi(url)) return; // straight to the network

  // App pages: always try the network so updates show up immediately.
  if (req.mode === "navigate" && sameOrigin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(async () => (await caches.match("/", { cacheName: SHELL })) || offlinePage())
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      })
    );
  }
});

function offlinePage() {
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · BachelorMate</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0f;color:#eee;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><img src="/icons/icon-192.png" width="72" height="72" alt="" style="border-radius:18px"><h1 style="font-size:20px;margin:16px 0 6px">You're offline</h1>
<p style="color:#aaa;margin:0 0 20px">Connect to the internet to open BachelorMate.</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 18px;border-radius:10px;border:0;background:#7c3aed;color:#fff">Try again</button></div></body>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// Web push (only used when the server has push keys configured).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "BachelorMate", body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "BachelorMate", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/maskable-192.png",
      tag: data.tag,
      data: { url: data.url || "/notifications" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        open.focus();
        return open.navigate(target);
      }
      return self.clients.openWindow(target);
    })
  );
});
