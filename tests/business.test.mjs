import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBusinessRecord, normalizeBuyer, summarizeChannels, businessDate } from '../src/lib/business.mjs';
const booth = () => ({ channel: 'booth', date: '2026-09-18', title: 'Weekend market', items: [{ name: 'Chocolate', prepared: 100, quantity: 70, waste: 5, unitPrice: 2.5 }, { name: 'Matcha', prepared: 50, quantity: 30, waste: 2, unitPrice: 3 }], expenses: [{ description: 'Booth fee', amount: 40 }, { description: 'Packaging', amount: 12.5 }], discount: 5, notes: '' });
const wholesale = () => ({ channel: 'wholesale', date: '2026-09-18', title: 'Cafe', buyerId: 'cafe-1', contact: 'Mei / 0123456789', items: [{ name: 'Chocolate', quantity: 100, unitPrice: 2 }, { name: 'Matcha', quantity: 50, unitPrice: 2.5 }], expenses: [], received: 100, discount: 0 });
test('booth tracks flavour quantities, leftovers, discounts and expenses', () => {
 const result = normalizeBusinessRecord(booth());
 assert.deepEqual(result.items.map(i => i.leftover), [25, 18]);
 assert.equal(result.sales, 260); assert.equal(result.expenseTotal, 52.5); assert.equal(result.received, 260);
});
test('wholesale uses price per piece per flavour and tracks partial payment', () => {
 const result = normalizeBusinessRecord(wholesale());
 assert.equal(result.sales, 325); assert.equal(result.outstanding, 225);
 assert.equal(normalizeBusinessRecord({ ...wholesale(), received: 325 }).outstanding, 0);
});
test('rejects overselling, fractions, negative amounts, missing prices and duplicated flavours', () => {
 for (const changes of [{ quantity: 101 }, { quantity: 1.5 }, { unitPrice: -1 }, { unitPrice: '' }, { unitPrice: ' ' }, { unitPrice: [] }, { waste: 40 }, { unitPrice: Infinity }]) {
 const input = booth(); input.items[0] = { ...input.items[0], ...changes };
 assert.throws(() => normalizeBusinessRecord(input));
 }
 const input = booth(); input.items.push({ ...input.items[0], name: ' chocolate ' });
 assert.throws(() => normalizeBusinessRecord(input), /duplicate/);
});
test('rejects impossible date, overpayment and excessive discount', () => {
 assert.throws(() => normalizeBusinessRecord({ ...booth(), date: '2026-02-30' }));
 assert.throws(() => normalizeBusinessRecord({ ...wholesale(), received: 326 }));
 assert.throws(() => normalizeBusinessRecord({ ...booth(), discount: 500 }));
 assert.throws(() => normalizeBuyer({ name: 'Cafe', contact: ' ' }));
});
test('zero-sales booth days retain expenses and prepared stock', () => {
 const input = booth(); input.items.forEach(i => { i.quantity = 0; i.waste = 0; }); input.discount = 0;
 const result = normalizeBusinessRecord(input);
 assert.equal(result.sales, 0); assert.equal(result.expenseTotal, 52.5); assert.equal(result.items[0].leftover, 100);
});
test('rounds cents and ignores client-supplied totals', () => {
 const input = wholesale(); input.items = [{ name: 'Mini', quantity: 3, unitPrice: 0.1 }]; input.received = 0; input.sales = 999;
 assert.equal(normalizeBusinessRecord(input).sales, 0.3);
});
test('overview counts verified online orders and channel records once, in Malaysia dates', () => {
 const base = { created_at: '2026-09-17T18:00:00Z', total: 20, order_status: 'completed', payment_status: 'verified' };
 const orders = [base, { ...base, is_manual_order: true }, { ...base, order_status: 'cancelled' }, { ...base, payment_status: 'pending' }, { ...base, created_at: '2026-09-16T00:00:00Z' }];
 const summary = summarizeChannels(orders, [normalizeBusinessRecord(booth()), normalizeBusinessRecord(wholesale())], '2026-09-18', '2026-09-18');
 assert.equal(summary.preorder, 20); assert.equal(summary.total, 605); assert.equal(summary.outstanding, 225); assert.equal(summary.expenses, 52.5); assert.equal(summary.manualOrders, 1);
 assert.equal(businessDate('2026-09-17T18:00:00Z'), '2026-09-18');
});

test('order sales are counted on the day completed, not the day customer placed order', () => {
  // Order placed on Sept 10, completed on Sept 18
  const pastOrder = {
    order_id: 'OB-20260910-0001',
    created_at: '2026-09-10T02:00:00Z',
    completed_at: '2026-09-18T04:00:00Z',
    order_status: 'completed',
    payment_status: 'verified',
    total: 88
  };
  // Order placed on Sept 18, but still preparing (not completed)
  const preparingOrder = {
    order_id: 'OB-20260918-0002',
    created_at: '2026-09-18T02:00:00Z',
    order_status: 'preparing',
    payment_status: 'verified',
    total: 50
  };

  // On Sept 10 (order date): pastOrder is not completed yet on that day, so preorder sales should be 0
  const summarySept10 = summarizeChannels([pastOrder, preparingOrder], [], '2026-09-10', '2026-09-10');
  assert.equal(summarySept10.preorder, 0);

  // On Sept 18 (completion date): pastOrder is completed today, so it counts (RM88). preparingOrder is not completed yet so not counted.
  const summarySept18 = summarizeChannels([pastOrder, preparingOrder], [], '2026-09-18', '2026-09-18');
  assert.equal(summarySept18.preorder, 88);
});

test('general expenses (flour, butter, etc.) are included in total expenses and deducted from net income', () => {
  const financeRecords = [
    { id: 'f1', date: '2026-09-18', category: '食材', amount: 85.5, note: 'Anchor Butter & Flour', receiptUrl: 'https://drive.google.com/file/d/test1' },
    { id: 'f2', date: '2026-09-18', category: '包装', amount: 24.5, note: 'Cookie Tins' },
    { id: 'f3', date: '2026-09-10', category: '食材', amount: 150.0, note: 'Out of range expense' },
  ];

  // Booth sales: 260, Booth expenses: 52.50
  // General expenses for 2026-09-18: 85.50 + 24.50 = 110.00
  // Total expenses: 52.50 + 110.00 = 162.50
  // Total sales: 260
  // Net revenue: 260 - 162.50 = 97.50
  const summary = summarizeChannels([], [normalizeBusinessRecord(booth())], '2026-09-18', '2026-09-18', financeRecords);

  assert.equal(summary.booth, 260);
  assert.equal(summary.generalExpenses, 110.0);
  assert.equal(summary.expenses, 162.5);
  assert.equal(summary.net, 97.5);
});

