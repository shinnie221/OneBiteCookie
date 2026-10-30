'use client';

export const CACHE_KEYS = {
  PRODUCTS: 'one_bite_cached_products',
  SETTINGS: 'one_bite_cached_settings',
  ANNOUNCEMENT: 'one_bite_cached_announcement',
  TIMESTAMP: 'one_bite_cache_timestamp',
};

/**
 * Safely retrieve an item from localStorage
 */
export function getCachedItem(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('[Cache] Failed to read from localStorage:', e);
    return null;
  }
}

/**
 * Safely write an item to localStorage
 */
export function setCachedItem(key, data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('[Cache] Failed to write to localStorage:', e);
  }
}

/**
 * Preload an array of image URLs into the browser's HTTP/memory cache.
 * (Not the Cache API: cross-origin no-cors fetches come back opaque, so a
 * failed load would be stored and served back as if it were the photo.)
 */
export function preloadImageUrls(urls = []) {
  if (typeof window === 'undefined' || !Array.isArray(urls)) return;

  const validUrls = Array.from(
    new Set(
      urls.filter(
        (url) =>
          typeof url === 'string' &&
          (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) &&
          !url.startsWith('data:')
      )
    )
  );

  validUrls.forEach((src) => {
    try {
      const img = new Image();
      img.src = src;
    } catch (err) {
      // Ignore background preload errors
    }
  });
}

/**
 * Register the image caching Service Worker
 */
export function registerServiceWorker() {
  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    window.location.protocol.startsWith('http')
  ) {
    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => {
          console.debug('[SW] Registration failed:', err);
        });
    };
    // This runs after hydration, often after 'load' has already fired, so
    // waiting for it would only register on slow loads (mostly phones)
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }
}

/**
 * Warm up storefront products and settings in background (e.g. while on login screen)
 */
export async function warmupStorefrontCache() {
  if (typeof window === 'undefined') return;

  try {
    const [prodRes, settRes] = await Promise.all([
      fetch('/api/products').catch(() => null),
      fetch('/api/settings').catch(() => null),
    ]);

    let prodList = [];
    if (prodRes && prodRes.ok) {
      const prodData = await prodRes.json();
      if (prodData?.products) {
        prodList = prodData.products;
        setCachedItem(CACHE_KEYS.PRODUCTS, prodList);
      }
    }

    let settingsObj = null;
    if (settRes && settRes.ok) {
      const settData = await settRes.json();
      if (settData?.settings) {
        settingsObj = settData.settings;
        setCachedItem(CACHE_KEYS.SETTINGS, settingsObj);
      }
    }

    // Collect and preload all product and brand images
    const imageUrls = [];
    if (settingsObj?.banner_image) imageUrls.push(settingsObj.banner_image);
    if (settingsObj?.banner_image_desktop) imageUrls.push(settingsObj.banner_image_desktop);
    if (settingsObj?.avatar_image) imageUrls.push(settingsObj.avatar_image);
    imageUrls.push('/logo.png', '/logo-white.png');

    prodList.forEach((p) => {
      if (Array.isArray(p.images)) imageUrls.push(...p.images);
      if (p.image) imageUrls.push(p.image);
    });

    preloadImageUrls(imageUrls);
  } catch (err) {
    console.debug('[Cache] Warmup error:', err);
  }
}
