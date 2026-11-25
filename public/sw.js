// Offline support: app and word list are network-first (to get updates), audio is cache-first.
const CACHE = 'hebrew-cards-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isAudio = /\/audio\/[0-9a-f]{8}\.mp3$/.test(req.url);
  e.respondWith(isAudio ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw new Error('offline and not cached');
  }
}
