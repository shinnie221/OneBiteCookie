// One Bite - Image & Asset Service Worker Cache
const CACHE_NAME = 'one-bite-images-v1';

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
  
  const url = request.url;
  // Match common image extensions
  if (/\.(png|jpe?g|webp|svg|gif|avif)($|\?)/i.test(url)) return true;
  
  // Match external image hosts used in One Bite (ImgBB, Google user avatars, etc.)
  if (url.includes('i.ibb.co') || url.includes('ibb.co') || url.includes('googleusercontent.com')) {
    return true;
  }
  
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Never intercept API routes or Next.js internal files
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) {
    return;
  }

  // Handle Image Requests: Stale-While-Revalidate with Cache-First Fallback
  if (isImageRequest(request)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        
        // Background network fetch to keep cache fresh
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              cache.put(request, networkResponse.clone()).catch(() => {});
            }
            return networkResponse;
          })
          .catch((err) => {
            // Network failure: return cached if available
            return cachedResponse;
          });

        // Return from cache immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
    );
  }
});
