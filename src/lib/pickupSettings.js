/**
 * Store pickup point shown on checkout and order confirmation.
 * Staff edit these in the storefront settings; they live in settings/store_settings
 * as pickup_name, pickup_subtitle, pickup_address, pickup_time and pickup_maps_link.
 */

export const DEFAULT_PICKUP = {
  name: 'The Palette @ Danau Kota',
  subtitle: 'Store collection point in Setapak, Kuala Lumpur',
  address: 'The Palette, Danau Kota, 53300 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur',
  time: '11:00 AM',
  maps_link: 'https://www.google.com/maps/search/?api=1&query=The+Palette+Danau+Kota+Kuala+Lumpur',
};

// Only allow http(s) map links (blocks javascript: and other schemes)
export function sanitizeMapsLink(link) {
  const value = (link || '').trim();
  return /^https?:\/\//i.test(value) ? value : '';
}

// Build the pickup details from a store_settings doc. Name, address and time always
// fall back to the defaults; subtitle and map link can be cleared to hide them.
export function getPickupDetails(settings = {}) {
  const s = settings || {};
  return {
    name: s.pickup_name?.trim() || DEFAULT_PICKUP.name,
    subtitle: (s.pickup_subtitle ?? DEFAULT_PICKUP.subtitle).trim(),
    address: s.pickup_address?.trim() || DEFAULT_PICKUP.address,
    time: s.pickup_time?.trim() || DEFAULT_PICKUP.time,
    maps_link: sanitizeMapsLink(s.pickup_maps_link ?? DEFAULT_PICKUP.maps_link),
  };
}
