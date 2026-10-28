const CACHE_NAME = 'aether-static-v2';
const DOWNLOAD_CACHE_PREFIX = 'aether-audio-v2-';
const ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => !key.startsWith(DOWNLOAD_CACHE_PREFIX) && key !== CACHE_NAME &&
      (key.startsWith('vox-') || key.startsWith('aether-static-')))
    .map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Temporary media capabilities and private APIs must reach the server so an
  // expired/revoked link cannot be revived from an automatic shared cache.
  // Explicit downloads live in account-scoped caches and are read by the player.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/') ||
      url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/__offline_media/')) return;
  if (event.request.mode !== 'navigate' && !ASSETS.includes(url.pathname) && !url.pathname.startsWith('/assets/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const shell = await cache.match('/index.html');
        if (shell) return shell;
      }
      return new Response('Unavailable offline', { status: 503 });
    }
  })());
});
