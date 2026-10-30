'use client';

import Image from 'next/image';

// Hosts listed in images.remotePatterns (next.config.mjs). Only these can go
// through the Next image optimizer; anything else is shown as-is.
const OPTIMIZED_HOSTS = ['i.ibb.co'];

function canOptimize(src) {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && OPTIMIZED_HOSTS.includes(url.hostname);
  } catch {
    // Relative paths are served by us and are fine to optimize
    return src.startsWith('/');
  }
}

/**
 * Small square cookie photo, resized and cached by our own server instead of
 * being hot-linked from the image host, so it stays small and loads on phones.
 * Calls onError when the photo can't be loaded so the caller can fall back.
 */
export default function CookieThumb({ src, alt = '', size = 48, className, onError }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized={!canOptimize(src)}
      loading="eager"
      decoding="async"
      onError={onError}
    />
  );
}
