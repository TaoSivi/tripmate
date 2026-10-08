// Service worker: app works offline after first visit; map tiles you've seen stay cached.
const VERSION = 'tm-v9';
const SHELL = ['./', './index.html', './app.js', './lib.js', './backend.js', './fx.js', './fx.css', './money.js', './expenses.js', './exp.css', './paper.css', './icons.js', './paperart.js', './push.js', './config.js', './manifest.webmanifest', './icons/icon-192.png'];
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|www\.gstatic\.com\/firebasejs|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const TILE = /^https:\/\/(tile\.openstreetmap\.org|server\.arcgisonline\.com)\//;
const MAX_TILES = 600;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'tm-tiles').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = req.url;
  if (TILE.test(url)) return e.respondWith(tile(req));
  if (CDN.test(url)) return e.respondWith(cacheFirst(req));
  if (new URL(url).origin === location.origin) return e.respondWith(networkFirst(req));
});

// Own files: always try the network so updates show up immediately; fall back to cache offline.
async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req, { cache: 'no-cache' });   // revalidate: Pages' 10-min HTTP cache must not mix old and new modules
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function tile(req) {
  const cache = await caches.open('tm-tiles');
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      await cache.put(req, res.clone());
      cache.keys().then((keys) => { if (keys.length > MAX_TILES) keys.slice(0, keys.length - MAX_TILES).forEach((k) => cache.delete(k)); });
    }
    return res;
  } catch {
    return Response.error();
  }
}

// Push from the relay Worker. Chrome requires every push to show a notification, so when the app is already on
// screen (the in-app banner covers it) we show it and close it straight away.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'TripMate', body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const visible = wins.some((w) => w.visibilityState === 'visible');
    const tag = d.tag || 'tm-push';
    await self.registration.showNotification(d.title || 'TripMate', {
      body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag, renotify: true,
      requireInteraction: !!d.urgent, vibrate: d.urgent ? [500, 200, 500, 200, 500] : [120],
    });
    if (visible && !d.urgent) setTimeout(async () => { (await self.registration.getNotifications({ tag })).forEach((n) => n.close()); }, 800);
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list.find((w) => 'focus' in w);
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
