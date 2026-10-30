// One Bite - Image & Asset Service Worker Cache
// v2: only same-origin images with a real 200 are cached. v1 stored opaque
// cross-origin responses, which can hide failed loads, and served them forever.
const CACHE_NAME = 'one-bite-images-v2';

// Static brand assets to cache immediately upon install
const PRECACHE_ASSETS = [
  '/logo.png',
  '/logo-white.png',
  '/logo-transparent.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Helper to determine if a request is an image
function isImageRequest(request) {
  if (request.destination === 'image') return true;

  // Match common image extensions
  return /\.(png|jpe?g|webp|svg|gif|avif)($|\?)/i.test(request.url);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Cross-origin images (e.g. ImgBB) come back opaque, so we can't tell a
  // photo from an error page. Leave them to the browser's own HTTP cache.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API routes or Next.js internal files
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) {
    return;
  }

  // Handle Image Requests (incl. /_next/image): Stale-While-Revalidate
  if (isImageRequest(request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);

        // Background network fetch to keep cache fresh
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok && networkResponse.type === 'basic') {
              cache.put(request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || Response.error());

        // Return from cache immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
    );
  }
});
