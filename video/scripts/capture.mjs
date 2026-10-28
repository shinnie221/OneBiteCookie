// Captures real customer-facing pages of the local One Bite dev server (read-only browsing).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
const shot = async (name, opts = {}) => {
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, name + '.png'), ...opts });
  console.log('shot', name);
};
const clickText = async (selector, text) => {
  const ok = await page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find(e => e.textContent.trim().includes(t));
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
    return false;
  }, selector, text);
  if (!ok) console.log('NOT FOUND', selector, text);
  return ok;
};
const waitImages = () => page.evaluate(async () => {
  // Lazy images below the fold never start loading in a full-page shot, so force them
  document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
  await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; })));
  await document.fonts.ready;
});

await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.removeItem('onebite_cart'));
await page.reload({ waitUntil: 'networkidle0' });
// Hide the Home page's own promo video so the promo doesn't film itself
await page.addStyleTag({ content: '#video{display:none!important}' });
await sleep(1500);
await waitImages();
await shot('01-home-top');
await shot('02-home-full', { fullPage: true });

// Scroll to the cookie menu
await page.evaluate(() => document.getElementById('menu').scrollIntoView({ block: 'start' }));
await sleep(800); await waitImages();
await shot('03-menu');

// Product overlay
await clickText('h3, [class*="name"], [class*="Name"]', 'Strawberry White Choc');
await sleep(1200); await waitImages();
await shot('04-product');
await clickText('[role="radio"]', 'Box of 6');
await sleep(500);
await shot('05-product-box6');
await page.mouse.click(40, 450);
await sleep(800);

// BYOB modal: 5-piece box, one of each flavour
await page.evaluate(() => document.getElementById('byob')?.scrollIntoView({ block: 'start' }));
await sleep(600); await waitImages();
await shot('07-byob-section');
await clickText('h3', 'Build Your Own Box');
await sleep(1200); await waitImages();
await shot('08-byob-modal');
await clickText('button', '5 Pieces');
await sleep(400);
await clickText('button', '1 of Each');
await sleep(600);
await shot('09-byob-full');
await page.evaluate(() => { const m = document.querySelector('[class*="ByobModal"][class*="modal"]'); if (m) m.scrollTop = m.scrollHeight; });
await sleep(400);
await shot('10-byob-full-scrolled');

// Cart page, seeded locally (browser storage only, no server writes)
const products = (await (await fetch(BASE + '/api/products')).json()).products;
const byName = n => products.find(p => p.name === n);
const item = (p, variant, pieces, price, qty, extra = {}) => ({
  cart_item_id: `${p.id}_${variant}`, product_id: p.id, product_name: p.name, variant, variant_id: variant,
  variant_pieces: pieces, price, image: p.images?.[0] || p.image, quantity: qty, is_byob: false, flavours: null, flavour_summary: null, ...extra,
});
const byob = byName('Build Your Own Box (BYOB)');
const cart = { voucher: null, discount: 0, items: [
  item(byName('Strawberry White Choc'), 'Box of 6', 6, byName('Strawberry White Choc').box_6_price, 1),
  item(byName('Red Velvet White Choc'), 'Per piece', 1, byName('Red Velvet White Choc').price, 2),
  item(byob, 'Box of 5', 5, byob.box_5_price, 1, { is_byob: true, cart_item_id: 'byob_5_mix', flavour_summary: products.filter(p => !p.is_byob).map(p => `${p.name} ×1`).join(', ') }),
]};
await page.evaluate(c => localStorage.setItem('onebite_cart', JSON.stringify(c)), cart);
await page.goto(BASE + '/cart', { waitUntil: 'networkidle0' });
await sleep(1500); await waitImages();
await shot('11-cart');
await shot('12-cart-full', { fullPage: true });
await page.evaluate(() => localStorage.removeItem('onebite_cart'));
await browser.close();
