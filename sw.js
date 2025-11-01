// REPLACE WHOLE FILE: /sw.js
// MXD Canonical SW — HTML network-first; assets stale-while-revalidate;
// data JSON (affiliates/top/prices) network-first with cache fallback.
// FIND: MXD SW v2025-10-31-b01
const VERSION = '2025-11-01-a1';
const ASSET_CACHE = 'mxd-assets-' + VERSION;

self.addEventListener('install', (e) => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith('mxd-assets-') && k !== ASSET_CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;

  const u = new URL(r.url);

  // 1) HTML: network-first (offline fallback to / or /index.html)
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).catch(async () => (await caches.match('/') ) || (await caches.match('/index.html')) || Response.error())
    );
    return;
  }

  // 2) Data JSON: network-first (both root and /assets/data/)
  const isDataJson =
    (u.origin === location.origin) &&
    (
      /^\/(affiliates|top|prices)\.json$/i.test(u.pathname) ||
      /^\/assets\/data\/.+\.json$/i.test(u.pathname)
    );

  if (isDataJson) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(r, { cache: 'no-store' });
        const c = await caches.open(ASSET_CACHE);
        c.put(r, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(r);
        if (cached) return cached;
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
      }
    })());
    return;
  }

  // 3) Static assets: stale-while-revalidate
  if (/\.(?:css|js|png|jpg|jpeg|webp|svg|json|webmanifest|woff2?)$/i.test(u.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(ASSET_CACHE);
      const cached = await c.match(r);
      const fetching = fetch(r).then(n => { c.put(r, n.clone()); return n; }).catch(() => null);
      return cached || fetching || fetch(r);
    })());
  }
});
