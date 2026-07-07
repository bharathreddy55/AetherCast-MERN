const CACHE_NAME = 'aethercast-static-v1';
const AUDIO_CACHE_NAME = 'aethercast-audio-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Service Worker and cache static shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate & remove old cache directories
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== AUDIO_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper to determine if a request matches cached audio
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // If it's an audio stream request
  if (url.pathname.includes('/uploads/')) {
    e.respondWith(
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached audio file directly
            return cachedResponse;
          }
          // Fall back to network
          return fetch(e.request);
        });
      })
    );
    return;
  }

  // Standard static caching logic (network-first fallback to cache)
  if (e.request.method === 'GET' && !url.pathname.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Clone and cache the fresh asset
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Serve from cache if offline
          return caches.match(e.request);
        })
    );
  }
});
