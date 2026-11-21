// Scry service worker: opens instantly and works on weak signal.
// - Pages and app code: network first (so updates always arrive), cached copy if offline.
// - Images, fonts and libraries: cache first (they never change at the same address).
// - Supabase (your data, Penny, scanner): never cached, always live.
const CACHE = 'scry-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'brand/scry-icon.svg', 'brand/scry-mark.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co') || url.searchParams.has('check')) return;
  const sameOrigin = url.origin === self.location.origin;
  const isCode = sameOrigin && (req.mode === 'navigate' || /\.(js|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/'));
  if (isCode) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  const isAsset = (sameOrigin && /\/brand\//.test(url.pathname)) || /cdn\.jsdelivr\.net|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (isAsset) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
