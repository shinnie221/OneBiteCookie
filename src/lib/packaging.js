/**
 * Packaging and variant options helper for cookie products.
 * Allows customers to buy cookies "Per piece" or per box ("Box of 4", "Box of 6", "Box of 12")
 * matching the Take.app Bakery Sora experience.
 */


export const DEFAULT_BYOB_TIERS = [
  { id: 'box_4', name: 'Box of 4', pieces: 4, defaultPrice: 35.00 },
  { id: 'box_5', name: 'Box of 5 (Try All 5 Flavours!)', pieces: 5, defaultPrice: 44.00 },
  { id: 'box_6', name: 'Box of 6', pieces: 6, defaultPrice: 52.00 },
  { id: 'box_8', name: 'Box of 8', pieces: 8, defaultPrice: 70.00 },
  { id: 'box_12', name: 'Box of 12', pieces: 12, defaultPrice: 100.00 },
];

export function getByobTiers(product) {
  if (!product) return DEFAULT_BYOB_TIERS.map(t => ({ ...t, price: t.defaultPrice }));
  return DEFAULT_BYOB_TIERS.map(tier => {
    let customPrice = null;
    if (tier.id === 'box_4' && product.box_4_price) customPrice = Number(product.box_4_price);
    if (tier.id === 'box_5' && product.box_5_price) customPrice = Number(product.box_5_price);
    if (tier.id === 'box_6' && product.box_6_price) customPrice = Number(product.box_6_price);
    if (tier.id === 'box_8' && product.box_8_price) customPrice = Number(product.box_8_price);
    if (tier.id === 'box_12' && product.box_12_price) customPrice = Number(product.box_12_price);

    return {
      ...tier,
      price: customPrice && customPrice > 0 ? customPrice : tier.defaultPrice
    };
  });
}

export function getProductPackagingOptions(product) {
  if (!product) return [];

  // If BYOB product
  if (product.is_byob) {
    return getByobTiers(product);
  }

  // If product has explicit variants array configured
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.map((v, i) => ({
      id: v.id || `var_${i}`,
      name: v.name || 'Per piece',
      pieces: Number(v.pieces) || 1,
      price: Number(v.price) || Number(product.price) || 0,
    }));
  }

  const basePrice = Number(product.price) || 0;
  const options = [
    { id: 'piece', name: 'Per piece', pieces: 1, price: basePrice }
  ];

  // Only add box options if has_box_options is enabled AND staff explicitly configured a price
  if (product.has_box_options !== false) {
    if (product.box_4_price !== undefined && product.box_4_price !== null && product.box_4_price !== '' && Number(product.box_4_price) > 0) {
      options.push({ id: 'box_4', name: 'Box of 4', pieces: 4, price: Number(product.box_4_price) });
    }

    if (product.box_6_price !== undefined && product.box_6_price !== null && product.box_6_price !== '' && Number(product.box_6_price) > 0) {
      options.push({ id: 'box_6', name: 'Box of 6', pieces: 6, price: Number(product.box_6_price) });
    }

    if (product.box_12_price !== undefined && product.box_12_price !== null && product.box_12_price !== '' && Number(product.box_12_price) > 0) {
      options.push({ id: 'box_12', name: 'Box of 12', pieces: 12, price: Number(product.box_12_price) });
    }
  }

  return options;
}

export function formatPrice(num) {
  return Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function getProductPriceRange(product, currencySymbol = '₱') {
  if (!product) return `${currencySymbol}0.00`;

  // For regular cookies, even if they have box packaging options, only show the minimum price
  if (!product.is_byob) {
    const options = getProductPackagingOptions(product);
    if (!options || options.length === 0) {
      return `${currencySymbol}${formatPrice(product?.price || 0)}`;
    }
    const prices = options.map(o => o.price);
    const min = Math.min(...prices);
    return `${currencySymbol}${formatPrice(min)}`;
  }

  // For BYOB (custom boxes), show the range across box sizes (e.g. RM35.00 - RM100.00)
  const options = getProductPackagingOptions(product);
  if (!options || options.length === 0) {
    return `${currencySymbol}${formatPrice(product?.price || 0)}`;
  }
  const prices = options.map(o => o.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) {
    return `${currencySymbol}${formatPrice(min)}`;
  }
  return `${currencySymbol}${formatPrice(min)} - ${currencySymbol}${formatPrice(max)}`;
}
