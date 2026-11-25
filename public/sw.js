// Offline support: app and word list are network-first (to get updates), audio is cache-first.
const CACHE = 'hebrew-cards-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  ),
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isAudio = /\/audio\/[0-9a-f]{8}\.mp3$/.test(req.url);
  e.respondWith(isAudio ? cacheFirst(req) : networkFirst(req));
});

// Audio: always fetch and store the whole file (browsers ask for byte ranges, which can't be cached).
async function cacheFirst(req) {
  const url = req.url;
  const hit = await caches.match(url);
  if (hit) return hit;
  const res = await fetch(url);
  if (res.status === 200) (await caches.open(CACHE)).put(url, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.status === 200) (await caches.open(CACHE)).put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw new Error('offline and not cached');
  }
}
