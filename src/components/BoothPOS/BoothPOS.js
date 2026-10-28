'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { businessDate, money } from '@/lib/business.mjs';
import { uploadReceipt, receiptPreviewUrl } from '@/lib/receiptUpload';
import { getProductPackagingOptions, getByobTiers } from '@/lib/packaging';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import BusinessChannel from '@/components/BusinessChannel/BusinessChannel';
import styles from './BoothPOS.module.css';

const DEFAULT_PREPARED = 20;
const DAY_PRESETS = [1, 2, 3, 5, 7, 14, 30];
const NOTE_PRESETS = ['试吃回购', '赠送包装盒', '熟客', '预订取货', '送礼'];
const EXPENSE_PRESETS = ['摊位租金', '停车费', '冰块 / 物料', '包装袋'];
const WALLETS = ['DuitNow QR', "Touch 'n Go", 'GrabPay', '银行转账'];
const PAYERS = [
  { value: '公款账户', label: '公款账户' },
  { value: 'Shinnie', label: 'Shinnie 垫付' },
  { value: 'Yunxuan', label: 'Yunxuan 垫付' },
];
const UNDO_MS = 8000;

// Audio chime generator for instant touch-register feedback
function playCashChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Non-blocking if audio blocked by browser policy
  }
}

function matchProduct(item, productList) {
  if (!item || !Array.isArray(productList) || productList.length === 0) return null;
  const itemName = (item.name || '').trim().toLowerCase();
  const cleanItemName = itemName.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();

  // 1. By productId / id
  if (item.productId || item.id) {
    const byId = productList.find(p => p.id === (item.productId || item.id));
    if (byId) return byId;
  }

  // 2. Exact name match (case-insensitive)
  const byExact = productList.find(p => (p.name || '').trim().toLowerCase() === itemName);
  if (byExact) return byExact;

  // 3. Clean name match (ignoring parenthesized chinese/english annotations)
  if (cleanItemName) {
    const byClean = productList.find(p => {
      const pClean = (p.name || '').trim().toLowerCase().replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();
      return pClean === cleanItemName;
    });
    if (byClean) return byClean;
  }

  // 4. Substring / includes match
  const byIncludes = productList.find(p => {
    const pName = (p.name || '').trim().toLowerCase();
    return pName && itemName && (pName.includes(itemName) || itemName.includes(pName));
  });
  if (byIncludes) return byIncludes;

  return null;
}

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Pieces of each flavour a sold item used. Older transactions only stored { name, quantity } per flavour.
function itemPieces(item) {
  if (item && item.pieces && typeof item.pieces === 'object') return item.pieces;
  return { [item.name]: Number(item.quantity) || 0 };
}

function addPieces(map, pieces, times = 1) {
  for (const [name, count] of Object.entries(pieces)) {
    map[name] = (map[name] || 0) + (Number(count) || 0) * times;
  }
  return map;
}

function scalePieces(pieces, times) {
  return Object.fromEntries(Object.entries(pieces).map(([name, count]) => [name, count * times]));
}

// Suggested notes a customer is likely to hand over for a given total
function tenderOptions(total) {
  const opts = [];
  for (const step of [5, 10, 20, 50, 100]) {
    const v = Math.ceil((total + 0.001) / step) * step;
    if (v > total && !opts.includes(v)) opts.push(v);
  }
  return opts.sort((a, b) => a - b).slice(0, 5);
}

function orderSeq(tx) {
  return parseInt(String(tx.orderNumber || '').replace(/\D/g, ''), 10) || 0;
}

function txItemsSummary(tx) {
  return tx.items.map(it => {
    const label = it.label || it.name;
    const mix = it.kind === 'mix' && it.pieces
      ? `（${Object.entries(it.pieces).map(([n, c]) => `${n}×${c / (it.quantity || 1)}`).join(' · ')}）`
      : '';
    return `${label}${mix} x${it.quantity}`;
  }).join('， ');
}

function CookieImage({ src, alt, className }) {
  if (src) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
  }
  return <span className={`${className || ''} ${styles.imgFallback}`} aria-hidden="true">🍪</span>;
}

export default function BoothPOS() {
  const { authFetch } = useAuth();
  const toast = useToast();

  // 'pos' (现场收银) | 'inv' (库存与试吃) | 'hist' (今日流水) | 'ledger' (摆摊账本)
  const [activeView, setActiveView] = useState('pos');

  // Booth Session Info
  const [boothDate, setBoothDate] = useState(businessDate());
  const [boothTitle, setBoothTitle] = useState('');
  const [boothNotes, setBoothNotes] = useState('');
  const [boothDays, setBoothDays] = useState(1); // Staff sets event duration (e.g. 1, 2, 3 days)

  // Products & Inventory - strictly follows active menu cookies
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSession, setSavingSession] = useState(false);
  const [qrImage, setQrImage] = useState('');

  // Cart Register State
  const [unitSize, setUnitSize] = useState(1); // pieces per tap: 1 = 单片, 4/6/12 = 同口味盒装
  const [cart, setCart] = useState([]);
  const [popKey, setPopKey] = useState(null);
  const [discountType, setDiscountType] = useState('none'); // 'none' | '10' | 'custom' | 'voucher'
  const [customDiscountValue, setCustomDiscountValue] = useState('');
  const [voucher, setVoucher] = useState(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherError, setVoucherError] = useState('');
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [openPanel, setOpenPanel] = useState(null); // 'disc' | 'note' | null
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'qr'
  const [orderNote, setOrderNote] = useState('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Payment sheet: { received, wallet, doneTx }
  const [pay, setPay] = useState(null);
  const [undoTx, setUndoTx] = useState(null);
  const undoSnapshotRef = useRef(null);
  const undoTimerRef = useRef(null);

  // Mix & match box builder: { tierId, counts }
  const [mix, setMix] = useState(null);

  // Transactions list for the day
  const [transactions, setTransactions] = useState([]);
  const [historyTab, setHistoryTab] = useState('all'); // 'all' | 'cash' | 'qr'

  // Booth Expenses
  const [boothExpenses, setBoothExpenses] = useState([]);

  // Modals
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCloseBoothModalOpen, setIsCloseBoothModalOpen] = useState(false);
  const [customDaysMode, setCustomDaysMode] = useState(false);

  // New Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    receiptUrl: '',
    paid_by: '公款账户'
  });
  const [uploadingExpensePhoto, setUploadingExpensePhoto] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  // Local storage cache key
  const storageKey = `onebite_pos_${boothDate}`;

  // Sync products from menu with POS inventory:
  // Strictly follows active menu cookie flavours (excludes BYOB custom box packages & hidden items)
  const syncMenuWithInventory = useCallback((menuProducts, currentInventory) => {
    if (!Array.isArray(menuProducts) || menuProducts.length === 0) {
      return [];
    }

    const validMenuCookies = menuProducts.filter(p => !p.is_byob && p.available !== false && p.available !== 0);

    return validMenuCookies.map(p => {
      const pImg = p.image || (Array.isArray(p.images) && p.images[0]) || null;
      const existing = (currentInventory || []).find(it => matchProduct(it, [p]));
      const unitPrice = Number(p.price) || (existing ? Number(existing.unitPrice) : 8.90);

      return {
        productId: p.id,
        name: p.name,
        unitPrice,
        prepared: existing && existing.prepared !== undefined ? Number(existing.prepared) : DEFAULT_PREPARED,
        waste: existing && existing.waste !== undefined ? Number(existing.waste) : 0,
        image: pImg,
        // Same box sizes and prices the storefront offers for this flavour
        options: getProductPackagingOptions(p)
          .filter(o => o.pieces > 1 && o.price > 0)
          .map(o => ({ pieces: o.pieces, price: Number(o.price) }))
      };
    });
  }, []);

  // Fetch latest products from menu and sync to inventory
  const fetchAndSyncMenu = useCallback(async (baseInventory = null) => {
    try {
      const res = await authFetch('/api/products', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const freshProducts = data.products || [];
        if (freshProducts.length > 0) {
          setProducts(freshProducts);
          setInventory(prev => syncMenuWithInventory(freshProducts, baseInventory || prev));
          return freshProducts;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch/sync menu products in POS:', err);
    }
    return null;
  }, [authFetch, syncMenuWithInventory]);

  // Helper to get latest cookie image directly following the menu
  const getItemImage = useCallback((item) => {
    const matched = matchProduct(item, products);
    if (matched) {
      if (matched.image) return matched.image;
      if (Array.isArray(matched.images) && matched.images.length > 0) return matched.images[0];
    }
    return item?.image || null;
  }, [products]);

  // Transparent-background cookie for the mix box (null when the flavour has no cutout yet)
  const getItemCutout = useCallback((item) => {
    return matchProduct(item, products)?.cutout_image || null;
  }, [products]);

  // Load initial products and restore local transactions if any
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        let cachedInventory = [];
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.transactions) setTransactions(parsed.transactions);
            if (parsed.boothTitle !== undefined) setBoothTitle(parsed.boothTitle);
            if (parsed.boothNotes !== undefined) setBoothNotes(parsed.boothNotes);
            if (parsed.boothDays !== undefined) {
              setBoothDays(parsed.boothDays);
              setCustomDaysMode(!DAY_PRESETS.includes(Number(parsed.boothDays)));
            }
            if (parsed.boothExpenses) setBoothExpenses(parsed.boothExpenses);
            if (Array.isArray(parsed.inventory) && parsed.inventory.length > 0) {
              cachedInventory = parsed.inventory;
            }
          } catch (e) {
            console.warn('Failed to parse cached POS data:', e);
          }
        }

        // Fetch fresh products from menu, ensuring images and prices ALWAYS follow the menu
        const fetched = await fetchAndSyncMenu(cachedInventory);
        if (!fetched && cachedInventory.length > 0) {
          setInventory(cachedInventory);
        }
      } catch (err) {
        console.error('POS init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [fetchAndSyncMenu, storageKey]);

  // Shop QR code uploaded under 系统设置 › QR 收款
  useEffect(() => {
    let cancelled = false;
    authFetch('/api/settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data?.settings?.qr_code) setQrImage(data.settings.qr_code);
      })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [authFetch]);

  // Listen for window focus, storage changes, or custom events when staff changes cookie images in menu
  useEffect(() => {
    const handleSync = () => {
      fetchAndSyncMenu();
    };

    const handleStorage = (e) => {
      if (e.key === 'onebite_menu_updated_at') {
        fetchAndSyncMenu();
      }
    };

    window.addEventListener('focus', handleSync);
    window.addEventListener('onebite_menu_updated', handleSync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('onebite_menu_updated', handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [fetchAndSyncMenu]);

  // Persist transactions and inventory
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          transactions,
          inventory,
          boothTitle,
          boothNotes,
          boothDays,
          boothExpenses
        }));
      } catch (e) {
        // quota exceeded or private mode
      }
    }
  }, [transactions, inventory, boothTitle, boothNotes, boothDays, boothExpenses, storageKey, loading]);

  useEffect(() => () => clearTimeout(undoTimerRef.current), []);

  // =========================================================================
  // Derived Real-Time Statistics
  // =========================================================================

  // Pieces sold per flavour (boxes and mix boxes count every piece inside)
  const soldByFlavour = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      for (const item of tx.items) addPieces(map, itemPieces(item));
    }
    return map;
  }, [transactions]);

  // Pieces of each flavour sitting in the current order
  const inCartByFlavour = useMemo(() => {
    const map = {};
    for (const line of cart) addPieces(map, line.pieces, line.quantity);
    return map;
  }, [cart]);

  const stockOf = useCallback((item) => {
    const sold = soldByFlavour[item.name] || 0;
    const waste = Number(item.waste) || 0;
    const remaining = Math.max(0, (Number(item.prepared) || 0) - sold - waste);
    const inCart = inCartByFlavour[item.name] || 0;
    return { sold, waste, remaining, inCart, free: Math.max(0, remaining - inCart) };
  }, [soldByFlavour, inCartByFlavour]);

  // Transactions segregated by payment method
  const cashTransactions = useMemo(() => transactions.filter(t => t.paymentMethod === 'cash'), [transactions]);
  const qrTransactions = useMemo(() => transactions.filter(t => t.paymentMethod === 'qr'), [transactions]);

  const displayTransactions = useMemo(() => {
    if (historyTab === 'cash') return cashTransactions;
    if (historyTab === 'qr') return qrTransactions;
    return transactions;
  }, [historyTab, cashTransactions, qrTransactions, transactions]);

  // Overall Live Stats
  const liveStats = useMemo(() => {
    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let cashSales = 0;
    let qrSales = 0;
    let cardSales = 0;

    for (const tx of transactions) {
      grossSales += Number(tx.subtotal) || 0;
      totalDiscount += Number(tx.discount) || 0;
      netSales += Number(tx.total) || 0;

      if (tx.paymentMethod === 'cash') cashSales += Number(tx.total) || 0;
      else if (tx.paymentMethod === 'qr') qrSales += Number(tx.total) || 0;
      else cardSales += Number(tx.total) || 0; // legacy transactions only
    }

    const piecesSold = Object.values(soldByFlavour).reduce((sum, n) => sum + n, 0);
    const expenseTotal = boothExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const wastePieces = inventory.reduce((sum, it) => sum + (Number(it.waste) || 0), 0);

    return {
      grossSales,
      totalDiscount,
      netSales,
      piecesSold,
      wastePieces,
      orderCount: transactions.length,
      cashSales,
      qrSales,
      cardSales,
      expenseTotal,
      netProfit: netSales - expenseTotal
    };
  }, [transactions, boothExpenses, inventory, soldByFlavour]);

  // Unit buttons: 单片 plus every box size any flavour offers
  const unitOptions = useMemo(() => {
    const sizes = new Map();
    for (const item of inventory) {
      for (const o of item.options || []) {
        if (!sizes.has(o.pieces)) sizes.set(o.pieces, []);
        sizes.get(o.pieces).push(o.price);
      }
    }
    const piecePrices = inventory.map(i => Number(i.unitPrice) || 0);
    const describe = (prices) => {
      if (!prices.length) return { price: 0, varies: false };
      const min = Math.min(...prices);
      return { price: min, varies: Math.max(...prices) !== min };
    };
    const units = [{ size: 1, label: '单片', ...describe(piecePrices) }];
    [...sizes.keys()].sort((a, b) => a - b).forEach(size => {
      const info = describe(sizes.get(size));
      const minPiece = piecePrices.length ? Math.min(...piecePrices) : 0;
      units.push({ size, label: `${size} 片盒`, ...info, save: round2(minPiece * size - info.price) });
    });
    return units;
  }, [inventory]);

  // A box size can disappear when the menu changes; fall back to single pieces
  const activeUnit = unitOptions.find(u => u.size === unitSize) || unitOptions[0];

  // Mix & match boxes follow the storefront BYOB product's tiers
  const byobProduct = useMemo(() => products.find(p => p.is_byob && p.available !== false && p.available !== 0), [products]);
  const mixTiers = useMemo(() => (byobProduct ? getByobTiers(byobProduct) : []), [byobProduct]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => round2(cart.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0)), [cart]);
  const cartPieces = useMemo(() => Object.values(inCartByFlavour).reduce((s, n) => s + n, 0), [inCartByFlavour]);
  const cartUnits = useMemo(() => cart.reduce((s, line) => s + line.quantity, 0), [cart]);

  const voucherShortfall = voucher && discountType === 'voucher' && cartSubtotal < (Number(voucher.min_order) || 0)
    ? round2((Number(voucher.min_order) || 0) - cartSubtotal)
    : 0;

  const cartDiscountAmount = useMemo(() => {
    if (cartSubtotal <= 0) return 0;

    if (discountType === '10') return Math.round(cartSubtotal * 10) / 100;

    if (discountType === 'custom') {
      const val = parseFloat(customDiscountValue);
      return isNaN(val) ? 0 : Math.min(cartSubtotal, Math.max(0, round2(val)));
    }

    if (discountType === 'voucher' && voucher) {
      if (cartSubtotal < (Number(voucher.min_order) || 0)) return 0;
      const value = Number(voucher.discount_value) || 0;
      const amount = voucher.discount_type === 'percentage' ? cartSubtotal * value / 100 : value;
      return Math.min(cartSubtotal, round2(amount));
    }

    return 0;
  }, [cartSubtotal, discountType, customDiscountValue, voucher]);

  const discountLabel = discountType === '10' ? '10% OFF'
    : discountType === 'custom' ? '立减'
      : discountType === 'voucher' && voucher ? voucher.code : '';

  const cartFinalTotal = useMemo(() => {
    return round2(Math.max(0, cartSubtotal - cartDiscountAmount));
  }, [cartSubtotal, cartDiscountAmount]);

  const nextOrderNumber = useMemo(() => transactions.reduce((m, tx) => Math.max(m, orderSeq(tx)), 0) + 1, [transactions]);

  // =========================================================================
  // Cart Actions
  // =========================================================================

  const flashLine = (key) => {
    setPopKey(key);
    setTimeout(() => setPopKey(k => (k === key ? null : k)), 400);
  };

  // Every flavour needs enough free pieces for the extra units
  const findShortage = (pieces) => {
    for (const [name, count] of Object.entries(pieces)) {
      const item = inventory.find(it => it.name === name);
      const free = item ? stockOf(item).free : 0;
      if (count > free) return { name, free };
    }
    return null;
  };

  const handleAddFlavour = (item) => {
    const size = activeUnit.size;
    const option = size === 1 ? { pieces: 1, price: Number(item.unitPrice) } : (item.options || []).find(o => o.pieces === size);
    if (!option) {
      toast.error(`【${item.name}】没有 ${size} 片盒装`);
      return;
    }
    const shortage = findShortage({ [item.name]: size });
    if (shortage) {
      toast.error(`【${item.name}】剩余库存不足，仅剩 ${shortage.free} 片`);
      return;
    }

    const kind = size === 1 ? 'piece' : 'box';
    const key = `${kind}:${item.name}:${size}`;
    setCart(prev => {
      const idx = prev.findIndex(line => line.key === key);
      if (idx > -1) return prev.map((line, i) => (i === idx ? { ...line, quantity: line.quantity + 1 } : line));
      return [...prev, {
        key,
        kind,
        label: size === 1 ? item.name : `${size}片盒 · ${item.name}`,
        flavour: item.name,
        size,
        unitPrice: option.price,
        quantity: 1,
        pieces: { [item.name]: size }
      }];
    });
    flashLine(key);
  };

  const handleUpdateQty = (index, delta) => {
    const line = cart[index];
    if (!line) return;
    if (delta > 0) {
      const shortage = findShortage(scalePieces(line.pieces, delta));
      if (shortage) {
        toast.error(`【${shortage.name}】库存不足，仅剩 ${shortage.free} 片`);
        return;
      }
    }
    setCart(prev => prev
      .map((it, i) => (i === index ? { ...it, quantity: it.quantity + delta } : it))
      .filter(it => it.quantity > 0));
  };

  const resetOrderExtras = () => {
    setDiscountType('none');
    setCustomDiscountValue('');
    setVoucher(null);
    setVoucherInput('');
    setVoucherError('');
    setOrderNote('');
    setOpenPanel(null);
  };

  const handleClearCart = () => {
    setCart([]);
    resetOrderExtras();
  };

  const handleApplyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherError('请输入优惠码');
      return;
    }
    setValidatingVoucher(true);
    setVoucherError('');
    try {
      const res = await authFetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal: cartSubtotal })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) throw new Error(data.error || '优惠码无效或已过期');
      const v = data.voucher;
      setVoucher({ code: v.code, discount_type: v.discount_type, discount_value: Number(v.discount_value) || 0, min_order: Number(v.min_order) || 0 });
      setVoucherInput(v.code);
    } catch (err) {
      setVoucher(null);
      setVoucherError(err.message || '优惠码无效或已过期');
    } finally {
      setValidatingVoucher(false);
    }
  };

  const chooseDiscount = (type) => {
    setDiscountType(type);
    setVoucherError('');
    // Fixed choices apply and fold away; typed ones keep the panel open
    if (type === 'none' || type === '10') setOpenPanel(null);
  };

  // =========================================================================
  // Mix & match box
  // =========================================================================
  const openMix = () => {
    const tier = mixTiers.find(t => t.pieces === 6) || mixTiers[0];
    if (!tier) return;
    setMix({ tierId: tier.id, counts: {} });
  };

  const mixTier = mix ? mixTiers.find(t => t.id === mix.tierId) : null;
  const mixFilled = mix ? Object.values(mix.counts).reduce((s, n) => s + n, 0) : 0;

  const changeMixCount = (name, delta) => {
    setMix(prev => {
      const filled = Object.values(prev.counts).reduce((s, n) => s + n, 0);
      const current = prev.counts[name] || 0;
      if (delta > 0 && filled >= mixTier.pieces) return prev;
      return { ...prev, counts: { ...prev.counts, [name]: Math.max(0, current + delta) } };
    });
  };

  const changeMixTier = (tierId) => {
    const tier = mixTiers.find(t => t.id === tierId);
    setMix(prev => {
      const counts = { ...prev.counts };
      let filled = Object.values(counts).reduce((s, n) => s + n, 0);
      const names = Object.keys(counts).reverse();
      for (const name of names) {
        while (filled > tier.pieces && counts[name] > 0) {
          counts[name]--;
          filled--;
        }
      }
      return { tierId, counts };
    });
  };

  // Spread the remaining slots across flavours that still have stock
  const autoFillMix = () => {
    setMix(prev => {
      const counts = { ...prev.counts };
      let filled = Object.values(counts).reduce((s, n) => s + n, 0);
      let guard = 0;
      while (filled < mixTier.pieces && guard++ < 200) {
        const candidates = inventory.filter(it => stockOf(it).free - (counts[it.name] || 0) > 0);
        if (!candidates.length) break;
        candidates.sort((a, b) => (counts[a.name] || 0) - (counts[b.name] || 0));
        counts[candidates[0].name] = (counts[candidates[0].name] || 0) + 1;
        filled++;
      }
      return { ...prev, counts };
    });
  };

  const handleAddMix = () => {
    if (!mixTier || mixFilled !== mixTier.pieces) return;
    const pieces = Object.fromEntries(Object.entries(mix.counts).filter(([, n]) => n > 0));
    const shortage = findShortage(pieces);
    if (shortage) {
      toast.error(`【${shortage.name}】库存不足，仅剩 ${shortage.free} 片`);
      return;
    }
    const key = `mix:${mixTier.pieces}:${Object.keys(pieces).sort().map(n => `${n}=${pieces[n]}`).join(',')}`;
    setCart(prev => {
      const idx = prev.findIndex(line => line.key === key);
      if (idx > -1) return prev.map((line, i) => (i === idx ? { ...line, quantity: line.quantity + 1 } : line));
      return [...prev, {
        key,
        kind: 'mix',
        label: `混搭${mixTier.pieces}片礼盒`,
        size: mixTier.pieces,
        unitPrice: Number(mixTier.price),
        quantity: 1,
        pieces
      }];
    });
    setMix(null);
    flashLine(key);
  };

  // =========================================================================
  // Payment & Checkout
  // =========================================================================
  const openPayment = () => {
    if (cart.length === 0) {
      toast.error('当前收银台为空，请先点击曲奇加入订单');
      return;
    }
    if (voucherShortfall > 0) {
      toast.error(`优惠码 ${voucher.code} 还差 ${money(voucherShortfall)} 才达到最低消费`);
      return;
    }
    setMobileCartOpen(false);
    setPay({ received: '', wallet: WALLETS[0], doneTx: null });
  };

  const payReceived = pay && pay.received !== '' ? parseFloat(pay.received) : NaN;
  const payHasAmount = !isNaN(payReceived);
  const payDiff = payHasAmount ? round2(payReceived - cartFinalTotal) : 0;

  const handleKeypad = (key) => {
    setPay(prev => {
      if (!prev || prev.doneTx) return prev;
      let v = prev.received;
      if (key === '⌫' || key === 'Backspace') v = v.slice(0, -1);
      else if (key === 'C') v = '';
      else if (key === '.') { if (!v.includes('.')) v = `${v || '0'}.`; }
      else if (/^\d$/.test(key)) {
        const dot = v.indexOf('.');
        if (dot !== -1 && v.length - dot > 2) return prev;
        if (v.replace('.', '').length >= 6) return prev;
        v = v === '0' ? key : v + key;
      }
      return { ...prev, received: v };
    });
  };

  const handleCheckout = () => {
    if (!pay || pay.doneTx || cart.length === 0) return;

    if (paymentMethod === 'cash' && payHasAmount && payReceived < cartFinalTotal) {
      toast.error(`实收现金不足 (应收 ${money(cartFinalTotal)})`);
      return;
    }

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const received = paymentMethod === 'cash' ? (payHasAmount ? round2(payReceived) : cartFinalTotal) : null;

    const newTx = {
      id: `POS-${Date.now()}`,
      orderNumber: `#${nextOrderNumber}`,
      time: timeStr,
      items: cart.map(line => ({
        name: line.label,
        label: line.label,
        kind: line.kind,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        subtotal: round2(line.quantity * line.unitPrice),
        pieces: scalePieces(line.pieces, line.quantity)
      })),
      subtotal: cartSubtotal,
      discount: cartDiscountAmount,
      discountType,
      voucherCode: discountType === 'voucher' && voucher ? voucher.code : null,
      total: cartFinalTotal,
      paymentMethod,
      wallet: paymentMethod === 'qr' ? pay.wallet : null,
      cashReceived: received,
      change: paymentMethod === 'cash' ? round2(received - cartFinalTotal) : null,
      note: orderNote.trim()
    };

    undoSnapshotRef.current = {
      txId: newTx.id,
      cart,
      discountType,
      customDiscountValue,
      voucher,
      voucherInput,
      orderNote,
      paymentMethod
    };

    setTransactions(prev => [newTx, ...prev]);
    playCashChime();
    setCart([]);
    resetOrderExtras();
    setPay(prev => ({ ...prev, doneTx: newTx }));
  };

  const showUndoBar = (tx) => {
    setUndoTx(tx);
    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoTx(null), UNDO_MS);
  };

  const closePayment = () => {
    if (pay?.doneTx) showUndoBar(pay.doneTx);
    setPay(null);
  };

  // Undo the order just taken: drop it and put its items back in the cart
  const handleUndoLast = () => {
    const snap = undoSnapshotRef.current;
    if (!snap) return;
    setTransactions(prev => prev.filter(t => t.id !== snap.txId));
    setCart(snap.cart);
    setDiscountType(snap.discountType);
    setCustomDiscountValue(snap.customDiscountValue);
    setVoucher(snap.voucher);
    setVoucherInput(snap.voucherInput);
    setOrderNote(snap.orderNote);
    setPaymentMethod(snap.paymentMethod);
    undoSnapshotRef.current = null;
    clearTimeout(undoTimerRef.current);
    setUndoTx(null);
    setPay(null);
    toast.info('已撤销刚才的订单，商品已退回收银台');
  };

  // Void / Cancel Mistaken Transaction
  const handleVoidTransaction = (txId) => {
    if (!confirm('确定要作废/撤销这笔收银订单吗？\n撤销后所售出曲奇将立即退回今日剩余库存中。')) return;
    setTransactions(prev => prev.filter(t => t.id !== txId));
    if (undoSnapshotRef.current?.txId === txId) {
      undoSnapshotRef.current = null;
      setUndoTx(null);
    }
    toast.info('该收银订单已作废撤销，库存已恢复');
  };

  // Keyboard shortcuts for a laptop at the counter. Re-bound every render so it sees fresh state.
  const keyHandlerRef = useRef(null);
  useEffect(() => {
    keyHandlerRef.current = (e) => {
      if (pay) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (pay.doneTx) closePayment();
          else handleCheckout();
        } else if (e.key === 'Escape') {
          closePayment();
        } else if (!pay.doneTx && paymentMethod === 'cash' && (/^[\d.]$/.test(e.key) || e.key === 'Backspace')) {
          e.preventDefault();
          handleKeypad(e.key);
        }
        return;
      }
      if (activeView !== 'pos' || mix || isSessionModalOpen || isExpenseModalOpen || isCloseBoothModalOpen) return;
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Enter' && cart.length > 0 && (!typing || document.activeElement?.dataset?.posEnter === 'checkout')) {
        e.preventDefault();
        openPayment();
      } else if (e.key === 'Escape' && openPanel) {
        setOpenPanel(null);
      }
    };
  });
  useEffect(() => {
    const onKey = (e) => keyHandlerRef.current?.(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // =========================================================================
  // Inventory: prepared pieces and samples / waste
  // =========================================================================
  const updateInventory = (name, field, value) => {
    setInventory(prev => prev.map(it => (it.name === name ? { ...it, [field]: Math.max(0, parseInt(value, 10) || 0) } : it)));
  };

  const stepInventory = (item, field, delta) => {
    const s = stockOf(item);
    if (field === 'prepared') {
      const floor = s.sold + s.waste + s.inCart;
      updateInventory(item.name, 'prepared', Math.max(floor, (Number(item.prepared) || 0) + delta));
    } else {
      const ceiling = Math.max(0, (Number(item.prepared) || 0) - s.sold - s.inCart);
      updateInventory(item.name, 'waste', Math.min(ceiling, Math.max(0, s.waste + delta)));
    }
  };

  const resetPrepared = () => {
    setInventory(prev => prev.map(it => ({ ...it, prepared: DEFAULT_PREPARED, waste: 0 })));
    toast.info(`已恢复各口味准备量为 ${DEFAULT_PREPARED} 片/口味，试吃归零`);
  };

  // =========================================================================
  // Booth Expense Recording (Syncs to Finance & Business)
  // =========================================================================
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    // Guard against double taps / double submits creating duplicate finance records
    if (savingExpense || uploadingExpensePhoto) return;
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('请输入有效支出金额');
      return;
    }
    if (!expenseForm.description.trim()) {
      toast.error('请输入费用说明');
      return;
    }

    setSavingExpense(true);
    try {
      // Direct POST to /api/finance so it immediately appears in 成本支出 Tab!
      // finance_records is the single source of truth for booth expenses.
      const res = await authFetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: boothDate,
          transactionType: '支出',
          category: '摆摊支出',
          amount: amt,
          orderType: 'Booth',
          note: `摆摊现场 · ${expenseForm.description.trim()}`,
          supplierName: boothTitle,
          receiptUrl: expenseForm.receiptUrl.trim(),
          paid_by: expenseForm.paid_by,
          claim_status: expenseForm.paid_by === '公款账户' ? 'claimed' : 'pending',
          client_ref: expenseForm.clientRef
        })
      });

      if (!res.ok) throw new Error('保存费用失败');
      const saved = await res.json().catch(() => ({}));
      if (saved.duplicate) {
        setIsExpenseModalOpen(false);
        return;
      }

      setBoothExpenses(prev => [
        ...prev,
        {
          description: expenseForm.description.trim(),
          amount: amt,
          receiptUrl: expenseForm.receiptUrl.trim(),
          paid_by: expenseForm.paid_by
        }
      ]);

      toast.success(`摆摊费用 ${money(amt)} 已成功录入，并同步记录至「成本支出」Tab！`);
      setIsExpenseModalOpen(false);
      setExpenseForm({ description: '', amount: '', receiptUrl: '', paid_by: '公款账户' });
    } catch (err) {
      toast.error(err.message || '录入费用出错');
    } finally {
      setSavingExpense(false);
    }
  };

  const openExpenseModal = () => {
    // A fresh idempotency key per expense entry; the API ignores repeat submissions with the same key
    setExpenseForm(prev => ({ ...prev, clientRef: `booth-exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }));
    setIsExpenseModalOpen(true);
  };

  // =========================================================================
  // Save & Settle Booth Session to business_records (Daily Save or Final End)
  // =========================================================================
  const handleSaveBoothSession = async (isFinalClose = false) => {
    if (!boothTitle.trim()) {
      toast.error('请填写摆摊名称或地点');
      setIsCloseBoothModalOpen(false);
      setIsSessionModalOpen(true);
      return;
    }

    if (transactions.length === 0 && !isFinalClose) {
      if (!confirm('今日尚未产生任何 POS 收银订单，确定要保存摆摊记录吗？')) {
        return;
      }
    }

    setSavingSession(true);
    try {
      // Prepare normalized items for business_records
      const itemsPayload = inventory.map(item => ({
        name: item.name,
        unitPrice: Number(item.unitPrice),
        prepared: Number(item.prepared) || 0,
        quantity: soldByFlavour[item.name] || 0, // Exact pieces sold, boxes included
        waste: Number(item.waste) || 0,
      }));

      // business_records values every piece at its single-piece price, so box savings
      // are folded into the discount to keep 实收 equal to what the POS actually took.
      const pieceGross = itemsPayload.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
      const recordDiscount = Math.min(round2(pieceGross), Math.max(0, round2(pieceGross - liveStats.netSales)));
      const boxSavings = Math.max(0, round2(recordDiscount - liveStats.totalDiscount));

      const payload = {
        channel: 'booth',
        date: boothDate,
        title: boothTitle.trim(),
        days: Number(boothDays) || 1,
        items: itemsPayload,
        discount: recordDiscount,
        received: liveStats.netSales, // Exact money received
        status: isFinalClose ? 'completed' : 'preparing',
        // Booth expenses are already saved in finance_records (成本支出). Do NOT copy them here,
        // otherwise the ledger deducts them twice. They are listed in the notes for reference only.
        expenses: [],
        notes: `POS收银系统${isFinalClose ? '【最终收摊结单归档】' : '【阶段进度保存】'}（共${boothDays || 1}天活动）。完成 ${liveStats.orderCount} 笔订单，售出 ${liveStats.piecesSold} 片曲奇，实收 ${money(liveStats.netSales)}。现金 ${money(liveStats.cashSales)} / QR ${money(liveStats.qrSales)}。${liveStats.totalDiscount > 0 ? `优惠折扣 ${money(liveStats.totalDiscount)}。` : ''}${boxSavings > 0 ? `盒装优惠 ${money(boxSavings)}（已计入折扣）。` : ''}${boothExpenses.length ? `现场支出(已记入成本支出): ${boothExpenses.map(e => `${e.description} ${money(e.amount)}`).join('、')}。` : ''}${boothNotes ? `备注: ${boothNotes}` : ''}`.slice(0, 1000)
      };

      const res = await authFetch('/api/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'record',
          id: `booth_${boothDate.replace(/-/g, '')}`,
          revision: 0,
          record: payload
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '保存出摊记录失败');
      }

      if (isFinalClose) {
        toast.success(`🎉 此次【${boothTitle || '市集摊位'}】摆摊已圆满结单！收银台已清空并归档至流水账本！`);
        setIsCloseBoothModalOpen(false);
        // Clear everything: stall name/location, notes, cart, checkout inputs, transactions, and reset cookies to default
        setTransactions([]);
        setCart([]);
        setBoothExpenses([]);
        setBoothTitle('');
        setBoothNotes('');
        setBoothDays(1);
        setCustomDaysMode(false);
        resetOrderExtras();
        setPaymentMethod('cash');
        setUnitSize(1);
        setUndoTx(null);
        undoSnapshotRef.current = null;
        setInventory(prev => prev.map(item => ({
          ...item,
          prepared: DEFAULT_PREPARED,
          waste: 0
        })));
        try {
          localStorage.removeItem(storageKey);
        } catch { }
      } else {
        setIsCloseBoothModalOpen(false);
        toast.success('今日摆摊进度已保存！明天或稍后可继续在此收款。');
      }
    } catch (err) {
      toast.error(err.message || '保存出摊记录出错');
    } finally {
      setSavingSession(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <LoadingSpinner text="正在加载摆摊收银系统与菜单..." />
      </div>
    );
  }

  // =========================================================================
  // Render pieces
  // =========================================================================
  const doneTx = pay?.doneTx;

  const renderLine = (line, idx) => {
    const flavourItem = line.kind !== 'mix' ? inventory.find(it => it.name === line.flavour) : null;
    const sub = line.kind === 'mix'
      ? Object.entries(line.pieces).map(([n, c]) => `${n}×${c}`).join(' · ')
      : `${money(line.unitPrice)} / ${line.kind === 'box' ? '盒' : '片'}`;
    return (
      <div className={`${styles.line} ${popKey === line.key ? styles.linePop : ''}`} key={line.key}>
        <div className={styles.lineThumb}>
          {line.kind === 'mix'
            ? <span className={styles.boxIcon} aria-hidden="true">🎁</span>
            : <CookieImage src={flavourItem ? getItemImage(flavourItem) : null} alt="" />}
        </div>
        <div className={styles.lineName}>
          {line.kind !== 'piece' && <span className={styles.tag}>{line.kind === 'mix' ? '混搭' : `${line.size}片盒`}</span>}
          {line.kind === 'mix' ? `${line.size} 片礼盒` : line.flavour}
          <div className={styles.lineSub}>{sub}</div>
        </div>
        <div className={styles.lineTotal}>{money(line.quantity * line.unitPrice)}</div>
        <div className={styles.stepper}>
          <button
            type="button"
            className={`${styles.stepBtn} ${line.quantity === 1 ? styles.stepBtnRemove : ''}`}
            onClick={() => handleUpdateQty(idx, -1)}
            aria-label={line.quantity === 1 ? `移除 ${line.label}` : `减少 ${line.label}`}
          >
            {line.quantity === 1 ? '🗑' : '−'}
          </button>
          <span className={styles.stepCount}>{line.quantity}</span>
          <button type="button" className={styles.stepBtn} onClick={() => handleUpdateQty(idx, 1)} aria-label={`增加 ${line.label}`}>+</button>
          {line.kind === 'piece' && (
            <button type="button" className={`${styles.stepBtn} ${styles.stepBtnWide}`} onClick={() => handleUpdateQty(idx, 5)} aria-label={`增加 5 片 ${line.label}`}>+5</button>
          )}
        </div>
      </div>
    );
  };

  const renderPayment = () => {
    if (doneTx) {
      return (
        <div className={styles.payBody}>
          <div className={styles.done}>
            <div className={styles.doneTick}>✓</div>
            {doneTx.paymentMethod === 'cash' ? (
              <>
                <h4>请找零</h4>
                <div className={styles.changeHuge}>{money(doneTx.change || 0)}</div>
                <p>收 {money(doneTx.cashReceived)} · 应收 {money(doneTx.total)}</p>
              </>
            ) : (
              <>
                <h4>已记录 {doneTx.wallet} 收款</h4>
                <div className={`${styles.changeHuge} ${styles.changeHugeQr}`}>{money(doneTx.total)}</div>
              </>
            )}
          </div>
          <button type="button" className={`${styles.confirmBig} ${styles.confirmNext}`} onClick={closePayment} autoFocus>
            下一单 <span className={styles.kbdHint}>Enter</span>
          </button>
          <button type="button" className={`btn btnSecondary ${styles.undoInline}`} onClick={handleUndoLast}>
            ↩︎ 撤销这单（退回收银台）
          </button>
        </div>
      );
    }

    if (paymentMethod === 'cash') {
      return (
        <div className={styles.payBody}>
          <div className={styles.payGrid}>
            <div>
              <div className={styles.dueBox}><span>应收</span><strong>{money(cartFinalTotal)}</strong></div>
              <div className={`${styles.recvBox} ${payHasAmount ? styles.recvBoxTyping : ''}`}>
                <span>顾客给</span>
                <strong className={payHasAmount ? '' : styles.placeholder}>{payHasAmount ? `RM${pay.received}` : '点面额或输入金额'}</strong>
              </div>
              {payHasAmount && payDiff < 0 ? (
                <div className={`${styles.changeBox} ${styles.changeBoxShort}`}><span>还差</span><strong>{money(-payDiff)}</strong></div>
              ) : (
                <div className={styles.changeBox}><span>找零</span><strong>{money(payHasAmount ? payDiff : 0)}</strong></div>
              )}
            </div>
            <div>
              <div className={styles.tenders}>
                <button type="button" className={`${styles.tender} ${styles.tenderExact}`} onClick={() => setPay(p => ({ ...p, received: cartFinalTotal.toFixed(2) }))}>刚好</button>
                {tenderOptions(cartFinalTotal).map(v => (
                  <button key={v} type="button" className={styles.tender} onClick={() => setPay(p => ({ ...p, received: String(v) }))}>RM{v}</button>
                ))}
              </div>
              <div className={styles.keypad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(k => (
                  <button key={k} type="button" className={styles.key} onClick={() => handleKeypad(k)} aria-label={k === '⌫' ? '删除' : k}>{k}</button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`${styles.confirmBig} ${styles.confirmCash}`}
            onClick={handleCheckout}
            disabled={payHasAmount && payDiff < 0}
          >
            {payHasAmount ? (payDiff >= 0 ? `完成收款 · 找零 ${money(payDiff)}` : '金额不足') : `完成收款（刚好 ${money(cartFinalTotal)}）`}
          </button>
        </div>
      );
    }

    return (
      <div className={styles.payBody}>
        <div className={styles.payGrid}>
          <div className={styles.qrWrap}>
            <div className={styles.qrCard}>
              {qrImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrImage} alt="店铺收款码" />
              ) : (
                <div className={styles.qrMissing}>尚未上传收款码<br />请到「系统设置 › QR 收款」上传</div>
              )}
              <small>One Bite · {pay.wallet}</small>
            </div>
          </div>
          <div className={styles.qrSide}>
            <div className={styles.dueBox}><span>请顾客扫码支付</span><strong>{money(cartFinalTotal)}</strong></div>
            <div>
              <div className={styles.fieldLabel}>付款方式（记录用）</div>
              <div className={styles.chips}>
                {WALLETS.map(w => (
                  <button key={w} type="button" className={`${styles.chip} ${pay.wallet === w ? styles.chipQrActive : ''}`} onClick={() => setPay(p => ({ ...p, wallet: w }))}>{w}</button>
                ))}
              </div>
            </div>
            <div className={styles.noticeInfo}>看到顾客手机上的「付款成功」画面后再确认。</div>
          </div>
        </div>
        <button type="button" className={`${styles.confirmBig} ${styles.confirmQr}`} onClick={handleCheckout}>
          ✓ 已收到 {money(cartFinalTotal)}
        </button>
      </div>
    );
  };

  const historyFilters = [
    { id: 'all', label: '全部', count: transactions.length, amount: liveStats.netSales },
    { id: 'cash', label: '💵 现金', count: cashTransactions.length, amount: liveStats.cashSales },
    { id: 'qr', label: '📱 QR', count: qrTransactions.length, amount: liveStats.qrSales },
  ];

  return (
    <div className={`${styles.shell} ${mobileCartOpen ? styles.cartOpen : ''}`}>
      {/* Row 1: booth session + session actions */}
      <div className={styles.topbar}>
        <button type="button" className={styles.sessionChip} onClick={() => setIsSessionModalOpen(true)} title="点击修改摆摊名称/日期/天数">
          <span className={styles.liveDot} aria-hidden="true" />
          <span className={styles.sessionText}>
            <span className={`${styles.sessionTitle} ${boothTitle ? '' : styles.sessionTitleEmpty}`}>{boothTitle || '点这里填写摆摊名称/地点'}</span>
            <span className={styles.sessionMeta}>{boothDate} · 共 {boothDays} 天</span>
          </span>
          <span className={styles.sessionEdit} aria-hidden="true">✏️</span>
        </button>
        <div className={styles.topActions}>
          <button type="button" className={styles.topBtn} onClick={openExpenseModal} title="录入摊位租金、停车等现场费用并拍照">
            🧾<span className={styles.topBtnLabel}>现场支出</span><span className={styles.count}>{boothExpenses.length}</span>
          </button>
          <button type="button" className={styles.topBtn} onClick={() => handleSaveBoothSession(false)} disabled={savingSession} title="保存今日营业流水与剩余库存进度（明天可继续出摊收款）">
            💾<span className={styles.topBtnLabel}>{savingSession ? '保存中...' : '保存进度'}</span>
          </button>
          <button type="button" className={`${styles.topBtn} ${styles.topBtnDark}`} onClick={() => setIsCloseBoothModalOpen(true)} disabled={savingSession} title="完成为期数天或今日的摆摊活动，最终结单并归档">
            🏁<span className={styles.topBtnLabel}>收摊结单</span>
          </button>
        </div>
      </div>

      {/* Row 2: views + live stats */}
      <div className={styles.subbar}>
        <div className={styles.tabs} role="tablist">
          {[
            { id: 'pos', label: '🛒 收银' },
            { id: 'inv', label: '📦 库存与试吃' },
            { id: 'hist', label: '🧾 今日流水', pill: transactions.length },
            { id: 'ledger', label: '📋 摆摊账本' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeView === tab.id}
              className={`${styles.tab} ${activeView === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveView(tab.id)}
            >
              {tab.label}{tab.pill !== undefined && <span className={styles.pill}>{tab.pill}</span>}
            </button>
          ))}
        </div>
        <div className={styles.stats}>
          <div className={`${styles.stat} ${styles.statBig}`}><span>今日实收</span><strong>{money(liveStats.netSales)}</strong></div>
          <div className={`${styles.stat} ${styles.statOpt}`}><span>💵 现金</span><strong>{money(liveStats.cashSales)}</strong></div>
          <div className={`${styles.stat} ${styles.statOpt}`}><span>📱 QR</span><strong>{money(liveStats.qrSales)}</strong></div>
          <div className={styles.stat}><span>订单 / 售出</span><strong>{liveStats.orderCount} 单 · {liveStats.piecesSold} 片</strong></div>
        </div>
      </div>

      {/* ========== POS ========== */}
      {activeView === 'pos' && (
        <div className={styles.pos}>
          <div className={styles.catalog}>
            <div className={styles.unitBar}>
              <span className={styles.unitLabel}>加入单位</span>
              {unitOptions.map(u => (
                <button
                  key={u.size}
                  type="button"
                  className={`${styles.unitBtn} ${activeUnit.size === u.size ? styles.unitBtnActive : ''}`}
                  onClick={() => setUnitSize(u.size)}
                  aria-pressed={activeUnit.size === u.size}
                >
                  <b>{u.label}</b>
                  <small>{money(u.price)}{u.varies ? ' 起' : ''}</small>
                  {u.size > 1 && u.save > 0 && !u.varies && <small className={styles.save}>省 {u.save.toFixed(2)}</small>}
                </button>
              ))}
            </div>
            <div className={styles.unitHint}>
              {activeUnit.size === 1
                ? <>点口味 = 加 <b>1 片</b></>
                : <>点口味 = 加 <b>1 盒 {activeUnit.size} 片同口味</b>{mixTiers.length > 0 ? ' · 要混口味请用「混搭礼盒」' : ''}</>}
            </div>

            <div className={styles.grid}>
              {inventory.length === 0 ? (
                <div className={styles.emptyGrid}>
                  <p style={{ fontSize: '1.8rem', margin: '0 0 8px' }}>🍪</p>
                  <p style={{ margin: 0, fontWeight: 600 }}>暂无可售曲奇口味</p>
                  <p style={{ fontSize: '0.82rem', margin: '4px 0 0' }}>请确保已在菜单管理中添加并上架曲奇商品</p>
                </div>
              ) : inventory.map(item => {
                const s = stockOf(item);
                const option = activeUnit.size === 1 ? { price: Number(item.unitPrice) } : (item.options || []).find(o => o.pieces === activeUnit.size);
                const canAdd = !!option && s.free >= activeUnit.size;
                const blockedReason = s.remaining === 0 ? '今日售罄' : !option ? '无此盒装' : !canAdd ? '不足 1 盒' : '';
                const stockClass = s.free === 0 ? styles.stockOut : s.free <= 5 ? styles.stockLow : '';
                return (
                  <button
                    key={item.name}
                    type="button"
                    className={`${styles.tile} ${canAdd ? '' : styles.tileDisabled} ${s.inCart ? styles.tileInCart : ''}`}
                    onClick={() => handleAddFlavour(item)}
                    aria-disabled={!canAdd}
                    title={blockedReason || `加入 ${activeUnit.size === 1 ? '1 片' : `${activeUnit.size} 片盒`} ${item.name}`}
                  >
                    {s.inCart > 0 && <span className={styles.badge}>{s.inCart} 片</span>}
                    <div className={styles.tilePhoto}>
                      <CookieImage src={getItemImage(item)} alt={item.name} />
                      {blockedReason && <div className={styles.blockedTag}>{blockedReason}</div>}
                    </div>
                    <div className={styles.tileBody}>
                      <div className={styles.tileName}>{item.name}</div>
                      <div className={styles.tileFoot}>
                        <div className={styles.tilePrice}>
                          {option ? money(option.price) : '—'}
                          {option && activeUnit.size > 1 && <small> /{activeUnit.size}片</small>}
                        </div>
                        <span className={`${styles.stock} ${stockClass}`}>{s.remaining === 0 ? '售罄' : `剩 ${s.free} 片`}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {mixTiers.length > 0 && inventory.length > 0 && (
                <button type="button" className={`${styles.tile} ${styles.mixTile}`} onClick={openMix}>
                  <div className={styles.mixTileInner}>
                    <div className={styles.mixIco} aria-hidden="true">🎁</div>
                    <div className={styles.tileName}>混搭礼盒</div>
                    <div className={styles.mixTileSub}>{mixTiers.map(t => t.pieces).join(' / ')} 片 · 自选口味</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Right: always-visible order panel (bottom sheet on phones) */}
          <aside className={styles.cart} aria-label="当前订单">
            <div className={styles.cartHead}>
              <h2 className={styles.cartTitle}>
                订单 #{nextOrderNumber}
                {cart.length > 0 && <small>{cartUnits} 件 · {cartPieces} 片</small>}
              </h2>
              <div>
                <button type="button" className={`${styles.linkBtn} ${styles.mobileOnly}`} onClick={() => setMobileCartOpen(false)}>收起 ▾</button>
                {cart.length > 0 && (
                  <button type="button" className={`${styles.linkBtn} ${styles.linkBtnDanger}`} onClick={() => { if (confirm('清空整张订单？')) handleClearCart(); }}>清空</button>
                )}
              </div>
            </div>

            <div className={styles.cartList}>
              {cart.length === 0 ? (
                <div className={styles.cartEmpty}>
                  <div className={styles.cartEmptyIcon}>🍪</div>
                  <strong>点左边的曲奇开始下单</strong>
                  <span>先在上方选「单片」或「盒装」</span>
                </div>
              ) : cart.map(renderLine)}
            </div>

            <div className={styles.cartFoot}>
              <div className={styles.extraRow}>
                <button
                  type="button"
                  className={`${styles.extraBtn} ${cartDiscountAmount > 0 || voucherShortfall > 0 ? styles.extraBtnOn : ''}`}
                  onClick={() => setOpenPanel(p => (p === 'disc' ? null : 'disc'))}
                  aria-expanded={openPanel === 'disc'}
                >
                  🏷️ {cartDiscountAmount > 0 ? `${discountLabel} −${cartDiscountAmount.toFixed(2)}` : voucherShortfall > 0 ? `${voucher.code} 未达门槛` : '优惠'}
                </button>
                <button
                  type="button"
                  className={`${styles.extraBtn} ${orderNote.trim() ? styles.extraBtnOn : ''}`}
                  onClick={() => setOpenPanel(p => (p === 'note' ? null : 'note'))}
                  aria-expanded={openPanel === 'note'}
                >
                  📝 {orderNote.trim() || '备注'}
                </button>
              </div>

              {openPanel === 'disc' && (
                <div className={styles.extraPanel}>
                  <div className={styles.chips}>
                    {[{ id: 'none', label: '无优惠' }, { id: '10', label: '10% OFF' }, { id: 'custom', label: '立减 RM' }, { id: 'voucher', label: '优惠码' }].map(o => (
                      <button key={o.id} type="button" className={`${styles.chip} ${discountType === o.id ? styles.chipActive : ''}`} onClick={() => chooseDiscount(o.id)}>{o.label}</button>
                    ))}
                  </div>
                  {discountType === 'custom' && (
                    <>
                      <div className={styles.chips}>
                        {[1, 2, 3, 5].map(v => (
                          <button key={v} type="button" className={`${styles.chip} ${parseFloat(customDiscountValue) === v ? styles.chipActive : ''}`} onClick={() => { setCustomDiscountValue(String(v)); setOpenPanel(null); }}>RM{v}</button>
                        ))}
                      </div>
                      <input
                        className={styles.input}
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        placeholder="其他金额，如 3.50"
                        value={customDiscountValue}
                        onChange={e => setCustomDiscountValue(e.target.value)}
                        autoFocus
                      />
                    </>
                  )}
                  {discountType === 'voucher' && (
                    <>
                      <div className={styles.inlineRow}>
                        <input
                          className={styles.input}
                          placeholder="输入优惠码"
                          value={voucherInput}
                          onChange={e => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(''); }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleApplyVoucher(); } }}
                          autoFocus
                        />
                        <button type="button" className={`${styles.chip} ${styles.chipActive}`} onClick={handleApplyVoucher} disabled={validatingVoucher}>
                          {validatingVoucher ? '验证中' : '使用'}
                        </button>
                      </div>
                      {voucherError ? <div className={`${styles.hint} ${styles.hintErr}`}>{voucherError}</div>
                        : voucher ? (
                          <div className={`${styles.hint} ${voucherShortfall > 0 ? styles.hintErr : styles.hintOk}`}>
                            {voucherShortfall > 0
                              ? `${voucher.code}：最低消费 ${money(voucher.min_order)}，还差 ${money(voucherShortfall)}`
                              : `✓ ${voucher.code} · ${voucher.discount_type === 'percentage' ? `${voucher.discount_value}% OFF` : `立减 ${money(voucher.discount_value)}`}`}
                          </div>
                        ) : <div className={styles.hint}>使用「系统设置 › 优惠券」里的优惠码</div>}
                    </>
                  )}
                </div>
              )}

              {openPanel === 'note' && (
                <div className={styles.extraPanel}>
                  <div className={styles.chips}>
                    {NOTE_PRESETS.map(n => (
                      <button key={n} type="button" className={`${styles.chip} ${orderNote === n ? styles.chipActive : ''}`} onClick={() => { setOrderNote(orderNote === n ? '' : n); setOpenPanel(null); }}>{n}</button>
                    ))}
                  </div>
                  <input
                    className={styles.input}
                    placeholder="选填备注 (如：试吃回购 / 赠送包装盒)"
                    value={orderNote}
                    onChange={e => setOrderNote(e.target.value)}
                    data-pos-enter="checkout"
                    autoFocus
                  />
                </div>
              )}

              <div className={styles.totals}>
                {cartDiscountAmount > 0 && (
                  <>
                    <div className={styles.totRow}><span>小计</span><span>{money(cartSubtotal)}</span></div>
                    <div className={`${styles.totRow} ${styles.totDisc}`}><span>优惠 ({discountLabel})</span><span>−{money(cartDiscountAmount)}</span></div>
                  </>
                )}
                <div className={styles.totGrand}><span>应收</span><strong>{money(cartFinalTotal)}</strong></div>
              </div>

              <div className={styles.methods}>
                <button type="button" className={`${styles.method} ${paymentMethod === 'cash' ? styles.methodCash : ''}`} onClick={() => setPaymentMethod('cash')} aria-pressed={paymentMethod === 'cash'}>
                  <span className={styles.methodIco}>💵</span>现金
                </button>
                <button type="button" className={`${styles.method} ${paymentMethod === 'qr' ? styles.methodQr : ''}`} onClick={() => setPaymentMethod('qr')} aria-pressed={paymentMethod === 'qr'}>
                  <span className={styles.methodIco}>📱</span>QR 扫码
                </button>
              </div>

              <button type="button" className={styles.chargeBtn} disabled={cart.length === 0} onClick={openPayment}>
                {cart.length === 0 ? '还没有商品' : (
                  <>{paymentMethod === 'cash' ? '💵 现金收款' : '📱 QR 收款'} {money(cartFinalTotal)} <kbd>Enter</kbd></>
                )}
              </button>
            </div>
          </aside>

          {mobileCartOpen && <div className={styles.sheetBackdrop} onClick={() => setMobileCartOpen(false)} aria-hidden="true" />}
          {cart.length > 0 && !mobileCartOpen && (
            <button type="button" className={styles.cartBar} onClick={() => setMobileCartOpen(true)}>
              <span>🛒 {cartUnits} 件 · {money(cartFinalTotal)}</span>
              <span>查看订单 ▴</span>
            </button>
          )}
        </div>
      )}

      {/* ========== Inventory ========== */}
      {activeView === 'inv' && (
        <div className={styles.pane}>
          <div className={styles.paneHead}>
            <div>
              <h2 className={styles.paneTitle}>库存与试吃</h2>
              <p className={styles.paneSub}>出摊前设好每种口味带来的片数；试吃/破损在这里加减。售出由收银自动扣除，盒装按片数计算。</p>
            </div>
            <div className={styles.paneActions}>
              <button
                type="button"
                className={styles.topBtn}
                onClick={async () => {
                  const res = await fetchAndSyncMenu();
                  if (res) toast.success('已同步菜单最新曲奇图片与售价！');
                  else toast.info('已尝试同步菜单');
                }}
              >
                🔄 同步菜单
              </button>
              <button type="button" className={styles.topBtn} onClick={resetPrepared}>↺ 重置为每种 {DEFAULT_PREPARED} 片</button>
            </div>
          </div>
          <div className={styles.invGrid}>
            {inventory.map(item => {
              const s = stockOf(item);
              const prepared = Number(item.prepared) || 0;
              const total = Math.max(1, prepared);
              const remClass = s.remaining === 0 ? styles.remOut : s.remaining <= 5 ? styles.remLow : '';
              const invalid = s.sold + s.waste > prepared;
              return (
                <div className={styles.invCard} key={item.name}>
                  <div className={styles.invTop}>
                    <div className={styles.lineThumb}><CookieImage src={getItemImage(item)} alt="" /></div>
                    <div>
                      <div className={styles.invName}>{item.name}</div>
                      <div className={styles.invMeta}>
                        {money(item.unitPrice)}/片{(item.options || []).map(o => ` · ${o.pieces}片盒 ${money(o.price)}`).join('')}
                      </div>
                    </div>
                  </div>
                  <div className={styles.bar} aria-hidden="true">
                    <i className={styles.barSold} style={{ width: `${Math.min(100, (s.sold / total) * 100)}%` }} />
                    <i className={styles.barWaste} style={{ width: `${Math.min(100, (s.waste / total) * 100)}%` }} />
                    <i className={styles.barCart} style={{ width: `${Math.min(100, (s.inCart / total) * 100)}%` }} />
                  </div>
                  <div className={styles.invNums}>
                    <div><span>已售</span><strong>{s.sold}</strong></div>
                    <div><span>试吃/损耗</span><strong>{s.waste}</strong></div>
                    <div className={`${styles.rem} ${remClass}`}><span>剩余</span><strong>{s.remaining}</strong></div>
                  </div>
                  <div className={styles.invRow}>
                    <label htmlFor={`prep-${item.name}`}>出摊准备</label>
                    <div className={styles.invStepper}>
                      <button type="button" className={`${styles.stepBtn} ${styles.stepBtnWide}`} onClick={() => stepInventory(item, 'prepared', -5)}>−5</button>
                      <button type="button" className={styles.stepBtn} onClick={() => stepInventory(item, 'prepared', -1)} aria-label="减少 1 片">−</button>
                      <input
                        id={`prep-${item.name}`}
                        className={styles.countInput}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={prepared}
                        onChange={e => updateInventory(item.name, 'prepared', e.target.value)}
                      />
                      <button type="button" className={styles.stepBtn} onClick={() => stepInventory(item, 'prepared', 1)} aria-label="增加 1 片">+</button>
                      <button type="button" className={`${styles.stepBtn} ${styles.stepBtnWide}`} onClick={() => stepInventory(item, 'prepared', 5)}>+5</button>
                    </div>
                  </div>
                  <div className={styles.invRow}>
                    <label htmlFor={`waste-${item.name}`} className={styles.wasteLbl}>试吃 / 破损</label>
                    <div className={styles.invStepper}>
                      <button type="button" className={styles.stepBtn} onClick={() => stepInventory(item, 'waste', -1)} aria-label="减少 1 片">−</button>
                      <input
                        id={`waste-${item.name}`}
                        className={`${styles.countInput} ${styles.countInputWaste}`}
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={s.waste}
                        onChange={e => updateInventory(item.name, 'waste', e.target.value)}
                      />
                      <button type="button" className={styles.stepBtn} onClick={() => stepInventory(item, 'waste', 1)} aria-label="增加 1 片">+</button>
                    </div>
                  </div>
                  {invalid && <div className={`${styles.hint} ${styles.hintErr}`}>准备量少于已售 + 试吃（{s.sold + s.waste} 片），结单会失败</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== History ========== */}
      {activeView === 'hist' && (
        <div className={styles.pane}>
          <div className={styles.paneHead}>
            <div>
              <h2 className={styles.paneTitle}>今日收银流水</h2>
              <p className={styles.paneSub}>按现金 / QR 对账；点错单可直接作废，库存自动退回。</p>
            </div>
          </div>
          <div className={styles.summaryRow}>
            <div><span>原价合计</span><strong>{money(liveStats.grossSales)}</strong></div>
            <div><span>优惠折扣</span><strong className={styles.discText}>−{money(liveStats.totalDiscount)}</strong></div>
            <div><span>现场支出</span><strong className={styles.errText}>−{money(liveStats.expenseTotal)}</strong></div>
            <div><span>摊位净利</span><strong className={liveStats.netProfit >= 0 ? styles.cashText : styles.errText}>{money(liveStats.netProfit)}</strong></div>
          </div>
          <div className={styles.histFilters}>
            {historyFilters.map(f => (
              <button key={f.id} type="button" className={`${styles.histFilter} ${historyTab === f.id ? styles.histFilterActive : ''}`} onClick={() => setHistoryTab(f.id)}>
                <span>{f.label} · {f.count} 笔</span>
                <strong>{money(f.amount)}</strong>
              </button>
            ))}
          </div>
          {displayTransactions.length === 0 ? (
            <div className={styles.emptyCard}>
              {historyTab === 'cash' ? '今日暂无现金收款记录' : historyTab === 'qr' ? '今日暂无 QR 转账收款记录' : '今日暂无收银订单流水。点单并收款后将实时展示于此。'}
            </div>
          ) : (
            <div className={styles.histList}>
              {displayTransactions.map(tx => (
                <div className={styles.tx} key={tx.id}>
                  <span className={styles.txNum}>{tx.orderNumber}</span>
                  <div className={styles.txMain}>
                    <div className={styles.txItems}>{txItemsSummary(tx)}</div>
                    <div className={styles.txMeta}>
                      <span>🕒 {tx.time}</span>
                      {tx.paymentMethod === 'cash' ? (
                        <span className={styles.cashText}>💵 现金{tx.cashReceived ? `（收 ${money(tx.cashReceived)} 找 ${money(tx.change || 0)}）` : ''}</span>
                      ) : (
                        <span className={styles.qrText}>📱 {tx.wallet || 'QR 转账'}</span>
                      )}
                      {tx.discount > 0 && <span className={styles.discText}>优惠 −{money(tx.discount)}{tx.voucherCode ? `（${tx.voucherCode}）` : ''}</span>}
                      {tx.note && <span>📝 {tx.note}</span>}
                    </div>
                  </div>
                  <span className={styles.txAmt}>{money(tx.total)}</span>
                  <button type="button" className={styles.topBtn} onClick={() => handleVoidTransaction(tx.id)} title="作废撤销此单">作废</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========== Ledger ========== */}
      {activeView === 'ledger' && (
        <div className={styles.pane}>
          <BusinessChannel channel="booth" />
        </div>
      )}

      {/* Undo bar after an order is completed */}
      {undoTx && !pay && (
        <div className={styles.undoBar} role="status">
          <span>订单 {undoTx.orderNumber} · {money(undoTx.total)} 已完成</span>
          <button type="button" onClick={handleUndoLast}>撤销</button>
        </div>
      )}

      {/* Modal: Payment */}
      <Modal
        isOpen={!!pay}
        onClose={closePayment}
        title={doneTx ? `订单 ${doneTx.orderNumber} 完成` : paymentMethod === 'cash' ? '💵 现金收款' : '📱 QR / 电子钱包收款'}
        maxWidth="760px"
      >
        {pay && renderPayment()}
      </Modal>

      {/* Modal: Mix & match box */}
      <Modal isOpen={!!mix} onClose={() => setMix(null)} title="🎁 混搭礼盒" maxWidth="760px">
        {mix && mixTier && (
          <div className={styles.modalStack}>
            <div>
              <div className={styles.fieldLabel}>盒子大小</div>
              <div className={styles.chips}>
                {mixTiers.map(t => (
                  <button key={t.id} type="button" className={`${styles.chip} ${mix.tierId === t.id ? styles.chipActive : ''}`} onClick={() => changeMixTier(t.id)}>
                    {t.pieces} 片 · {money(t.price)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className={styles.fieldLabel}>已放 {mixFilled} / {mixTier.pieces} 片</div>
              <div className={styles.slots}>
                {Array.from({ length: mixTier.pieces }, (_, i) => {
                  const order = Object.entries(mix.counts).flatMap(([n, c]) => Array(c).fill(n));
                  const name = order[i];
                  const item = name ? inventory.find(it => it.name === name) : null;
                  const cutout = item ? getItemCutout(item) : null;
                  return (
                    <div key={i} className={`${styles.slot} ${name ? styles.slotFilled : ''} ${cutout ? styles.slotCutout : ''}`} title={name || ''}>
                      {item && <CookieImage src={cutout || getItemImage(item)} alt="" />}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.mixList}>
              {inventory.map(item => {
                const count = mix.counts[item.name] || 0;
                const free = stockOf(item).free - count;
                const cutout = getItemCutout(item);
                return (
                  <div key={item.name} className={`${styles.mixItem} ${free <= 0 && !count ? styles.mixItemDisabled : ''}`}>
                    <div className={`${styles.lineThumb} ${cutout ? styles.thumbCutout : ''}`}><CookieImage src={cutout || getItemImage(item)} alt="" /></div>
                    <div className={styles.mixName}>{item.name}<small>剩 {Math.max(0, free)} 片</small></div>
                    <button type="button" className={styles.stepBtn} onClick={() => changeMixCount(item.name, -1)} disabled={!count} aria-label={`减少 ${item.name}`}>−</button>
                    <span className={styles.stepCount}>{count}</span>
                    <button type="button" className={styles.stepBtn} onClick={() => changeMixCount(item.name, 1)} disabled={free <= 0 || mixFilled >= mixTier.pieces} aria-label={`增加 ${item.name}`}>+</button>
                  </div>
                );
              })}
            </div>
            <div className={styles.modalActions}>
              <button type="button" className="btn btnSecondary" onClick={autoFillMix}>平均填满</button>
              <button type="button" className="btn btnSecondary" onClick={() => setMix(m => ({ ...m, counts: {} }))}>清空</button>
              <button type="button" className={`btn btnPrimary ${styles.grow}`} onClick={handleAddMix} disabled={mixFilled !== mixTier.pieces}>
                {mixFilled === mixTier.pieces ? `加入订单 · ${money(mixTier.price)}` : `还差 ${mixTier.pieces - mixFilled} 片`}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Booth session */}
      <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title="🎪 本次摆摊" maxWidth="520px">
        <div className={styles.modalStack}>
          <div>
            <label className={styles.fieldLabel} htmlFor="booth-title">摆摊名称 / 地点</label>
            <input id="booth-title" className={styles.input} placeholder="如: 谷中城市集" value={boothTitle} onChange={e => setBoothTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="booth-date">出摊日期</label>
            <input id="booth-date" className={styles.input} type="date" value={boothDate} onChange={e => e.target.value && setBoothDate(e.target.value)} />
            <div className={styles.hint}>换日期会切换到那天的收银记录。</div>
          </div>
          <div>
            <div className={styles.fieldLabel}>活动天数</div>
            <div className={styles.chips}>
              {DAY_PRESETS.map(d => (
                <button key={d} type="button" className={`${styles.chip} ${!customDaysMode && boothDays === d ? styles.chipActive : ''}`} onClick={() => { setCustomDaysMode(false); setBoothDays(d); }}>{d} 天</button>
              ))}
              <button type="button" className={`${styles.chip} ${customDaysMode ? styles.chipActive : ''}`} onClick={() => setCustomDaysMode(true)}>自定义</button>
            </div>
            {customDaysMode && (
              <div className={styles.inlineRow} style={{ marginTop: 8 }}>
                <input className={styles.input} type="number" min="1" max="365" value={boothDays} onChange={e => setBoothDays(Math.max(1, parseInt(e.target.value, 10) || 1))} aria-label="自定义天数" />
                <span>天</span>
              </div>
            )}
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="booth-notes">备注</label>
            <textarea id="booth-notes" className={styles.input} rows={2} placeholder="选填，如天气、人流情况" value={boothNotes} onChange={e => setBoothNotes(e.target.value)} />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={`btn btnPrimary ${styles.grow}`} onClick={() => setIsSessionModalOpen(false)}>完成</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Record Booth Expense with Camera Photo Upload */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="🧾 现场支出" maxWidth="520px">
        <form onSubmit={handleSaveExpense} className={styles.modalStack}>
          <div className={styles.noticeInfo}>录入后自动同步到「成本支出」，并计入本次摆摊日结。</div>
          <div>
            <label className={styles.fieldLabel} htmlFor="exp-desc">支出项目 *</label>
            <div className={styles.chips} style={{ marginBottom: 8 }}>
              {EXPENSE_PRESETS.map(p => (
                <button key={p} type="button" className={styles.chip} onClick={() => setExpenseForm(f => ({ ...f, description: p }))}>{p}</button>
              ))}
            </div>
            <input id="exp-desc" className={styles.input} required placeholder="例如: 摊位租金 (2天)" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className={styles.fieldLabel} htmlFor="exp-amt">金额 (RM) *</label>
            <input id="exp-amt" className={styles.input} type="number" inputMode="decimal" step="0.01" min="0.01" required placeholder="例如: 150.00" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div>
            <div className={styles.fieldLabel}>谁付的</div>
            <div className={styles.chips}>
              {PAYERS.map(p => (
                <button key={p.value} type="button" className={`${styles.chip} ${expenseForm.paid_by === p.value ? styles.chipActive : ''}`} onClick={() => setExpenseForm(f => ({ ...f, paid_by: p.value }))}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <input
              type="file"
              id="boothExpensePhotoInput"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingExpensePhoto(true);
                try {
                  const url = await uploadReceipt(file, authFetch, `摆摊_${boothDate}_${expenseForm.description || 'receipt'}`);
                  setExpenseForm(prev => ({ ...prev, receiptUrl: url }));
                  toast.success('单据已上传至 Google Drive！');
                } catch (err) {
                  toast.error(err.message || '上传图片出错，请重试');
                } finally {
                  setUploadingExpensePhoto(false);
                  e.target.value = '';
                }
              }}
            />
            <label htmlFor="boothExpensePhotoInput" className={styles.photoBtn}>
              {uploadingExpensePhoto ? '⏳ 正在上传中...' : expenseForm.receiptUrl ? '✓ 已附收据（点击重拍）' : '📷 拍照 / 上传收据'}
            </label>
            {expenseForm.receiptUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={receiptPreviewUrl(expenseForm.receiptUrl)} alt="凭证" className={styles.receiptPreview} />
            )}
          </div>
          {boothExpenses.length > 0 && (
            <div>
              <div className={styles.fieldLabel}>今天已录入</div>
              <div className={styles.expList}>
                {boothExpenses.map((e, i) => (
                  <div className={styles.expItem} key={`${e.description}-${i}`}>
                    <span>{e.description} <span className={styles.hint}>· {e.paid_by}</span></span>
                    <strong>{money(e.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className={styles.modalActions}>
            <button type="button" className="btn btnSecondary" onClick={() => setIsExpenseModalOpen(false)} disabled={savingExpense}>取消</button>
            <button type="submit" className={`btn btnPrimary ${styles.grow}`} disabled={savingExpense || uploadingExpensePhoto}>
              {savingExpense ? '保存中...' : '确认录入'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Close & Settle Entire Multi-day Booth Event */}
      <Modal isOpen={isCloseBoothModalOpen} onClose={() => setIsCloseBoothModalOpen(false)} title="🏁 收摊结单" maxWidth="560px">
        <div className={styles.modalStack}>
          <div className={styles.noticeWarn}>
            如果本次摆摊为期数天，前几天请点<strong>「只保存今日进度」</strong>继续出摊；只有<strong>最后一天完全收摊</strong>时才确认结单归档。
          </div>
          <div className={styles.summaryGrid}>
            <div><span>摊位</span><strong>{boothTitle || '（未命名）'}</strong></div>
            <div><span>日期 / 天数</span><strong>{boothDate} · {boothDays} 天</strong></div>
            <div><span>订单</span><strong>{liveStats.orderCount} 笔</strong></div>
            <div><span>售出 / 试吃</span><strong>{liveStats.piecesSold} / {liveStats.wastePieces} 片</strong></div>
            <div><span>💵 现金实收</span><strong className={styles.cashText}>{money(liveStats.cashSales)}</strong></div>
            <div><span>📱 QR 实收</span><strong className={styles.qrText}>{money(liveStats.qrSales)}</strong></div>
            <div><span>原价合计</span><strong>{money(liveStats.grossSales)}</strong></div>
            <div><span>优惠折扣</span><strong className={styles.discText}>−{money(liveStats.totalDiscount)}</strong></div>
            <div><span>现场支出</span><strong className={styles.errText}>−{money(liveStats.expenseTotal)}</strong></div>
            <div><span>今日实收</span><strong>{money(liveStats.netSales)}</strong></div>
            <div className={styles.summaryFull}><span>摊位净利（实收 − 现场支出）</span><strong>{money(liveStats.netProfit)}</strong></div>
          </div>
          <p className={styles.hint}>
            确认结单后会归档至流水账本，并清空收银台（摆摊名称、交易、购物车），各口味准备量恢复为 {DEFAULT_PREPARED} 片。
          </p>
          <div className={styles.modalActions}>
            <button type="button" className="btn btnSecondary" onClick={() => setIsCloseBoothModalOpen(false)} disabled={savingSession}>继续营业</button>
            <button type="button" className="btn btnSecondary" onClick={() => handleSaveBoothSession(false)} disabled={savingSession}>💾 只保存今日进度</button>
            <button type="button" className={`btn ${styles.btnDanger}`} onClick={() => handleSaveBoothSession(true)} disabled={savingSession}>
              {savingSession ? '正在结单归档...' : '🏁 确认结单'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
