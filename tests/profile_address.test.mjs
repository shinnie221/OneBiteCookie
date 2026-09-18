import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePhone,
  validatePostcode,
  normalizeAddress,
  setDefaultAddress,
  removeAddress,
  formatFullAddress,
  isStateDeliverable,
  getDeliverableNotice,
  DELIVERABLE_STATE,
  WHATSAPP_PHONE
} from '../src/lib/addresses.mjs';

test('validatePhone accepts valid Malaysian phone formats', () => {
  assert.equal(validatePhone('0123456789'), true);
  assert.equal(validatePhone('012-345 6789'), true);
  assert.equal(validatePhone('+60123456789'), true);
  assert.equal(validatePhone('+60 12-3456789'), true);
  assert.equal(validatePhone('123'), false);
  assert.equal(validatePhone('abcdefghij'), false);
  assert.equal(validatePhone(''), false);
});

test('validatePostcode accepts valid 5-digit postcodes', () => {
  assert.equal(validatePostcode('55100'), true);
  assert.equal(validatePostcode('47301'), true);
  assert.equal(validatePostcode('5510'), false);
  assert.equal(validatePostcode('551001'), false);
  assert.equal(validatePostcode('ABCDE'), false);
});

test('normalizeAddress normalizes valid address and defaults to isDefault when isFirstAddress', () => {
  const raw = {
    recipientName: 'Alice Tan',
    phone: '012-9876543',
    addressLine1: 'Unit 10-02, Block A, Menara 1',
    addressLine2: 'Jalan Tun Razak',
    city: 'Kuala Lumpur',
    state: 'Kuala Lumpur',
    postcode: '50400',
    label: 'Home'
  };

  const addr = normalizeAddress(raw, true);
  assert.equal(addr.recipientName, 'Alice Tan');
  assert.equal(addr.phone, '012-9876543');
  assert.equal(addr.isDefault, true);
  assert.ok(addr.id);

  const formatted = formatFullAddress(addr);
  assert.ok(formatted.includes('Unit 10-02'));
  assert.ok(formatted.includes('50400 Kuala Lumpur'));
});

test('normalizeAddress throws on missing required fields', () => {
  assert.throws(() => normalizeAddress({}), /Recipient name is required/);
  assert.throws(() => normalizeAddress({ recipientName: 'Bob' }), /Contact phone number is required/);
  assert.throws(() => normalizeAddress({ recipientName: 'Bob', phone: '0123456789' }), /Street address line 1 is required/);
  assert.throws(() => normalizeAddress({ recipientName: 'Bob', phone: '0123456789', addressLine1: 'Street 1' }), /City is required/);
  assert.throws(() => normalizeAddress({ recipientName: 'Bob', phone: '0123456789', addressLine1: 'Street 1', city: 'KL', state: '' }), /State is required/);
  assert.throws(() => normalizeAddress({ recipientName: 'Bob', phone: '0123456789', addressLine1: 'Street 1', city: 'KL', state: 'Kuala Lumpur' }), /Postal code is required/);
});

test('setDefaultAddress sets selected address as default and unsets others', () => {
  const addresses = [
    { id: 'addr-1', isDefault: true, recipientName: 'One' },
    { id: 'addr-2', isDefault: false, recipientName: 'Two' }
  ];

  const updated = setDefaultAddress(addresses, 'addr-2');
  assert.equal(updated.find(a => a.id === 'addr-1').isDefault, false);
  assert.equal(updated.find(a => a.id === 'addr-2').isDefault, true);
});

test('removeAddress removes address and reassigns default if deleted address was default', () => {
  const addresses = [
    { id: 'addr-1', isDefault: true, recipientName: 'One' },
    { id: 'addr-2', isDefault: false, recipientName: 'Two' }
  ];

  const remaining = removeAddress(addresses, 'addr-1');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, 'addr-2');
  assert.equal(remaining[0].isDefault, true);
});

test('isStateDeliverable strictly allows only Kuala Lumpur for delivery', () => {
  assert.equal(isStateDeliverable('Kuala Lumpur'), true);
  assert.equal(isStateDeliverable('kuala lumpur'), true);
  assert.equal(isStateDeliverable('KL'), true);
  assert.equal(isStateDeliverable('Wilayah Persekutuan Kuala Lumpur'), true);

  // Other states are NOT deliverable
  assert.equal(isStateDeliverable('Selangor'), false);
  assert.equal(isStateDeliverable('Johor'), false);
  assert.equal(isStateDeliverable('Penang'), false);
  assert.equal(isStateDeliverable('Melaka'), false);
  assert.equal(isStateDeliverable('Sabah'), false);
  assert.equal(isStateDeliverable(''), false);
  assert.equal(isStateDeliverable(null), false);
});

test('getDeliverableNotice generates Klang Valley WhatsApp inquiry url for non-KL states', () => {
  const klNotice = getDeliverableNotice('Kuala Lumpur');
  assert.equal(klNotice.deliverable, true);

  const selangorNotice = getDeliverableNotice('Selangor');
  assert.equal(selangorNotice.deliverable, false);
  assert.ok(selangorNotice.whatsappUrl.includes('601110897061'));
  assert.ok(selangorNotice.whatsappUrl.includes('Klang%20Valley'));
});
