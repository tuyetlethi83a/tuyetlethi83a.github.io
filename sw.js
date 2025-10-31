// REPLACE WHOLE FILE: /sw.js
const VERSION = '2025-10-31-b2';
const ASSET_CACHE = 'mxd-assets-' + VERSION;

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mxd-assets-') && !k.endsWith(VERSION)).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;

  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match('/'))); return; }

  if (u.origin === location.origin && /^\/(affiliates|top|prices)\.json$/i.test(u.pathname)) {
    e.respondWith((async()=>{ try{ const fresh=await fetch(r,{cache:'no-store'}); const c=await caches.open(ASSET_CACHE); c.put(r,fresh.clone()); return fresh; }catch(_){ const cached=await caches.match(r); return cached || new Response('[]',{status:200,headers:{'content-type':'application/json; charset=utf-8'}}); } })()); return;
  }

  if (/\.(?:css|js|png|jpg|jpeg|webp|svg|json|webmanifest)$/i.test(u.pathname)) {
    e.respondWith((async()=>{ const c=await caches.open(ASSET_CACHE); const cached=await c.match(r); const fetching=fetch(r).then(n=>{c.put(r,n.clone());return n}).catch(()=>null); return cached || fetching || fetch(r); })());
  }
});
