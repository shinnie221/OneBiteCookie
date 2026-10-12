/**
 * Default assets and presets for the customer storefront view (Take.app style)
 */

// Elegant default bakery banner for One Bite
export const DEFAULT_BANNER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ede4d8"/><stop offset="100%" stop-color="%23f8f4ed"/></linearGradient></defs><rect width="800" height="400" fill="url(%23g)"/><g fill="%233b2516" text-anchor="middle"><text x="400" y="175" font-family="'Georgia', serif" font-size="52" font-weight="bold" letter-spacing="6">ONE BITE</text><text x="400" y="230" font-family="'Inter', sans-serif" font-size="18" letter-spacing="8" opacity="0.75">HANDCRAFTED COOKIES</text><line x1="280" y1="260" x2="520" y2="260" stroke="%23A0714F" stroke-width="2" stroke-linecap="round"/></g><circle cx="240" cy="170" r="8" fill="%23A0714F" opacity="0.3"/><circle cx="560" cy="170" r="8" fill="%23A0714F" opacity="0.3"/></svg>`;

// Default dark chocolate circular logo with white cookie icon
export const DEFAULT_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="%232d1c10"/><circle cx="100" cy="100" r="58" fill="%23ffffff"/><circle cx="85" cy="80" r="7" fill="%232d1c10"/><circle cx="120" cy="85" r="6" fill="%232d1c10"/><circle cx="95" cy="115" r="7.5" fill="%232d1c10"/><circle cx="122" cy="120" r="5" fill="%232d1c10"/><circle cx="75" cy="110" r="5" fill="%232d1c10"/><circle cx="102" cy="72" r="4" fill="%232d1c10"/><path d="M142,75 Q155,90 148,110 Q160,118 145,130" fill="%232d1c10" opacity="0.12"/></svg>`;

// Preset banners the merchant can choose with one click
export const PRESET_BANNERS = [
  {
    id: 'onebite_artisan',
    name: 'One Bite (Warm Brown & Gold)',
    url: DEFAULT_BANNER
  },
  {
    id: 'sweet_cookie',
    name: 'Cute Cookie Studio (Soft Pink & Beige)',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><rect width="800" height="400" fill="%23fcf6f2"/><g fill="%235a3928" text-anchor="middle"><text x="400" y="190" font-family="'Brush Script MT', cursive, sans-serif" font-size="70" font-weight="bold">Sweet Bakes</text><text x="400" y="245" font-family="'Inter', sans-serif" font-size="16" letter-spacing="4" opacity="0.7">BAKED FRESH DAILY 🤎</text></g><circle cx="150" cy="120" r="25" fill="%23f7e6dc" opacity="0.6"/><circle cx="650" cy="280" r="35" fill="%23f7e6dc" opacity="0.6"/></svg>`
  }
];

// Preset avatars the merchant can choose with one click
export const PRESET_AVATARS = [
  {
    id: 'cookie_dark',
    name: 'Chocolate Cookie Icon',
    url: DEFAULT_AVATAR
  },
  {
    id: 'cookie_caramel',
    name: 'Caramel Cookie Icon',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="%23A0714F"/><circle cx="100" cy="100" r="58" fill="%23ffffff"/><circle cx="85" cy="80" r="7" fill="%23A0714F"/><circle cx="120" cy="85" r="6" fill="%23A0714F"/><circle cx="95" cy="115" r="7.5" fill="%23A0714F"/><circle cx="122" cy="120" r="5" fill="%23A0714F"/><circle cx="75" cy="110" r="5" fill="%23A0714F"/></svg>`
  },
  {
    id: 'chef_hat',
    name: 'Bakery Chef Hat',
    url: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="100" fill="%232d1c10"/><path d="M70,120 L130,120 L130,135 L70,135 Z" fill="%23ffffff"/><path d="M72,115 C60,115 55,95 70,85 C65,70 85,60 100,72 C115,60 135,70 130,85 C145,95 140,115 128,115 Z" fill="%23ffffff"/></svg>`
  }
];
