/**
 * Packaging and variant options helper for cookie products.
 * Allows customers to buy cookies "Per piece" or per box ("Box of 4", "Box of 6", "Box of 12")
 * matching the Take.app Bakery Sora experience.
 */

export function calculateDefaultBoxPrice(basePrice, count) {
  const price = Number(basePrice) || 0;
  if (price <= 0) return 0;

  // For high-denomination currencies like PHP (e.g., 90.00 per piece)
  if (price >= 50) {
    if (count === 4) return Math.max(0, Math.round((price * 4 - 10) / 10) * 10); // 90 * 4 - 10 = 350
    if (count === 6) return Math.max(0, Math.round((price * 6 - 20) / 10) * 10); // 90 * 6 - 20 = 520
    if (count === 12) return Math.max(0, Math.round((price * 12 - 60) / 10) * 10); // 90 * 12 - 60 = 1020
    return Math.round(price * count);
  }

  // For MYR/SGD/USD currencies (e.g. RM 8.90 per piece)
  if (count === 4) {
    // 8.90 * 4 = 35.60 -> RM 34.00
    const raw = price * 4 * 0.955;
    return Number(raw.toFixed(1)) === Math.round(raw) ? Math.round(raw) : Number(raw.toFixed(2));
  }
  if (count === 6) {
    // 8.90 * 6 = 53.40 -> RM 50.00
    const raw = price * 6 * 0.936;
    return Math.round(raw);
  }
  if (count === 12) {
    // 8.90 * 12 = 106.80 -> RM 98.00
    const raw = price * 12 * 0.917;
    return Math.round(raw);
  }
  return Number((price * count).toFixed(2));
}

export function getProductPackagingOptions(product) {
  if (!product) return [];

  // If product has explicit variants array configured
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.map((v, i) => ({
      id: v.id || `var_${i}`,
      name: v.name || 'Per piece',
      pieces: Number(v.pieces) || 1,
      price: Number(v.price) || Number(product.price) || 0,
    }));
  }

  // If product explicitly disabled box options
  if (product.has_box_options === false) {
    return [
      { id: 'piece', name: 'Per piece', pieces: 1, price: Number(product.price) || 0 }
    ];
  }

  const basePrice = Number(product.price) || 0;

  const box4Price = (product.box_4_price !== undefined && product.box_4_price !== null && product.box_4_price !== '')
    ? Number(product.box_4_price)
    : calculateDefaultBoxPrice(basePrice, 4);

  const box6Price = (product.box_6_price !== undefined && product.box_6_price !== null && product.box_6_price !== '')
    ? Number(product.box_6_price)
    : calculateDefaultBoxPrice(basePrice, 6);

  const box12Price = (product.box_12_price !== undefined && product.box_12_price !== null && product.box_12_price !== '')
    ? Number(product.box_12_price)
    : calculateDefaultBoxPrice(basePrice, 12);

  return [
    { id: 'piece', name: 'Per piece', pieces: 1, price: basePrice },
    { id: 'box_4', name: 'Box of 4', pieces: 4, price: box4Price },
    { id: 'box_6', name: 'Box of 6', pieces: 6, price: box6Price },
    { id: 'box_12', name: 'Box of 12', pieces: 12, price: box12Price },
  ];
}

export function formatPrice(num) {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function getProductPriceRange(product, currencySymbol = '₱') {
  const options = getProductPackagingOptions(product);
  if (!options || options.length === 0) {
    return `${currencySymbol}${formatPrice(product?.price || 0)}`;
  }
  if (options.length === 1) {
    return `${currencySymbol}${formatPrice(options[0].price)}`;
  }
  const prices = options.map(o => o.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    return `${currencySymbol}${formatPrice(min)}`;
  }
  return `${currencySymbol}${formatPrice(min)} - ${currencySymbol}${formatPrice(max)}`;
}
