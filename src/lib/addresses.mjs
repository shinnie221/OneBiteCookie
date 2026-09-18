// Helper methods and validation rules for customer delivery addresses

export const MALAYSIA_STATES = [
  'Kuala Lumpur',
  'Selangor',
  'Johor',
  'Kedah',
  'Kelantan',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Terengganu'
];

export const DELIVERABLE_STATE = 'Kuala Lumpur';
export const WHATSAPP_PHONE = '011-10897061';
export const WHATSAPP_RAW_PHONE = '601110897061';
export const WHATSAPP_INQUIRY_MSG = 'Hi OneBite, I am located in the Klang Valley area and would like to inquire about delivery.';
export const WHATSAPP_INQUIRY_URL = `https://wa.me/${WHATSAPP_RAW_PHONE}?text=${encodeURIComponent(WHATSAPP_INQUIRY_MSG)}`;

export function isStateDeliverable(state) {
  if (!state || typeof state !== 'string') return false;
  const clean = state.trim().toLowerCase();
  return clean === 'kuala lumpur' || clean === 'kl' || clean === 'wilayah persekutuan kuala lumpur';
}

export function getDeliverableNotice(state) {
  const deliverable = isStateDeliverable(state);
  return {
    deliverable,
    state: state || '',
    label: deliverable ? 'KL Delivery Available' : 'KL Delivery Only (Klang Valley Inquiry via WhatsApp)',
    whatsappUrl: WHATSAPP_INQUIRY_URL
  };
}

export const ADDRESS_LABELS = [
  { value: 'Home', label: '🏠 Home' },
  { value: 'Office', label: '🏢 Office' },
  { value: 'Other', label: '📍 Other' }
];

export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Clean phone: remove spaces, dashes, parentheses
  const clean = phone.replace(/[\s\-()]/g, '');
  // Standard Malaysian mobile numbers: 01xxxxxxxx (10-11 digits) or +601xxxxxxxx
  return /^(\+?60|0)1[0-9]{8,9}$/.test(clean);
}

export function validatePostcode(postcode) {
  if (!postcode || typeof postcode !== 'string') return false;
  const clean = postcode.trim();
  // 5-digit Malaysian postcode
  return /^[0-9]{5}$/.test(clean);
}

export function normalizeAddress(input, isFirstAddress = false) {
  if (!input || typeof input !== 'object') {
    throw new Error('Address data must be an object.');
  }

  const recipientName = (input.recipientName || input.recipient_name || '').trim();
  if (!recipientName) {
    throw new Error('Recipient name is required.');
  }
  if (recipientName.length > 100) {
    throw new Error('Recipient name cannot exceed 100 characters.');
  }

  const phone = (input.phone || '').trim();
  if (!phone) {
    throw new Error('Contact phone number is required.');
  }
  if (!validatePhone(phone)) {
    throw new Error('Please provide a valid phone number (e.g. 012-345 6789 or +60123456789).');
  }

  const addressLine1 = (input.addressLine1 || input.address_line_1 || '').trim();
  if (!addressLine1) {
    throw new Error('Street address line 1 is required.');
  }
  if (addressLine1.length > 200) {
    throw new Error('Address line 1 cannot exceed 200 characters.');
  }

  const addressLine2 = (input.addressLine2 || input.address_line_2 || '').trim();
  if (addressLine2.length > 200) {
    throw new Error('Address line 2 cannot exceed 200 characters.');
  }

  const city = (input.city || '').trim();
  if (!city) {
    throw new Error('City is required.');
  }
  if (city.length > 100) {
    throw new Error('City cannot exceed 100 characters.');
  }

  const state = (input.state !== undefined ? input.state : 'Kuala Lumpur').trim();
  if (!state) {
    throw new Error('State is required.');
  }

  const postcode = (input.postcode || '').trim();
  if (!postcode) {
    throw new Error('Postal code is required.');
  }
  if (!validatePostcode(postcode)) {
    throw new Error('Postal code must be a 5-digit number (e.g. 55100).');
  }

  const validLabels = ['Home', 'Office', 'Other'];
  const label = validLabels.includes(input.label) ? input.label : 'Home';

  const isDefault = isFirstAddress || Boolean(input.isDefault || input.is_default);

  return {
    id: input.id || crypto.randomUUID(),
    recipientName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    postcode,
    label,
    isDefault,
    updatedAt: new Date().toISOString()
  };
}

export function setDefaultAddress(addresses, targetId) {
  if (!Array.isArray(addresses)) return [];
  return addresses.map(addr => ({
    ...addr,
    isDefault: addr.id === targetId
  }));
}

export function removeAddress(addresses, targetId) {
  if (!Array.isArray(addresses)) return [];
  const filtered = addresses.filter(addr => addr.id !== targetId);
  // If the removed address was default and remaining addresses exist, make the first one default
  if (filtered.length > 0 && !filtered.some(a => a.isDefault)) {
    filtered[0].isDefault = true;
  }
  return filtered;
}

export function formatFullAddress(address) {
  if (!address) return '';
  const parts = [
    address.addressLine1,
    address.addressLine2,
    `${address.postcode} ${address.city}`,
    address.state
  ].filter(Boolean);
  return parts.join(', ');
}
