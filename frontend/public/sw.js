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

  // If it's an audio stream request (local uploads or Supabase public storage objects)
  if (url.pathname.includes('/uploads/') || url.pathname.includes('/storage/v1/object/public/')) {
    e.respondWith(
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) {
            const rangeHeader = e.request.headers.get('range');
            if (rangeHeader) {
              return cachedResponse.arrayBuffer().then((arrayBuffer) => {
                const bytes = /^bytes=(\d+)-(\d+)?$/.exec(rangeHeader);
                if (bytes) {
                  const start = parseInt(bytes[1], 10);
                  const end = bytes[2] ? parseInt(bytes[2], 10) : arrayBuffer.byteLength - 1;
                  const slice = arrayBuffer.slice(start, end + 1);
                  return new Response(slice, {
                    status: 206,
                    statusText: 'Partial Content',
                    headers: {
                      'Content-Range': `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
                      'Accept-Ranges': 'bytes',
                      'Content-Length': slice.byteLength,
                      'Content-Type': cachedResponse.headers.get('content-type') || 'audio/mpeg'
                    }
                  });
                }
              });
            }
            return cachedResponse;
          }
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
