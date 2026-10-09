'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { businessDate, money } from '@/lib/business.mjs';
import { uploadReceipt, receiptPreviewUrl } from '@/lib/receiptUpload';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import BusinessChannel from '@/components/BusinessChannel/BusinessChannel';
import styles from './BoothPOS.module.css';

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

const DEFAULT_PRESET_ITEMS = [
  { name: 'Original Cookie (经典原味)', unitPrice: 8.90, prepared: 50, waste: 0 },
  { name: 'Dark Choc Sea Salt (黑巧海盐)', unitPrice: 9.90, prepared: 40, waste: 0 },
  { name: 'Matcha White Choc (宇治抹茶白巧)', unitPrice: 9.90, prepared: 35, waste: 0 },
  { name: 'Earl Grey Lavender (伯爵红茶薰衣草)', unitPrice: 9.90, prepared: 30, waste: 0 },
  { name: 'Red Velvet Cream Cheese (红丝绒芝士)', unitPrice: 10.90, prepared: 25, waste: 0 },
];

export default function BoothPOS() {
  const { authFetch } = useAuth();
  const toast = useToast();

  // Mode: 'pos' (现场收银) | 'ledger' (日结与账本明细)
  const [activeView, setActiveView] = useState('pos');

  // Booth Session Info
  const [boothDate, setBoothDate] = useState(businessDate());
  const [boothTitle, setBoothTitle] = useState('市集快闪摊位');
  const [boothNotes, setBoothNotes] = useState('');

  // Products & Inventory
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState(DEFAULT_PRESET_ITEMS);
  const [loading, setLoading] = useState(true);
  const [savingSession, setSavingSession] = useState(false);

  // Cart Register State
  const [cart, setCart] = useState([]);
  const [discountType, setDiscountType] = useState('none'); // 'none' | '10' | 'custom'
  const [customDiscountValue, setCustomDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'qr'
  const [cashReceived, setCashReceived] = useState('');
  const [orderNote, setOrderNote] = useState('');

  // Transactions list for the day
  const [transactions, setTransactions] = useState([]);

  // Booth Expenses
  const [boothExpenses, setBoothExpenses] = useState([]);

  // Modals
  const [isPrepModalOpen, setIsPrepModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [selectedWasteItem, setSelectedWasteItem] = useState(null);
  const [wasteCountInput, setWasteCountInput] = useState('1');

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

  // Load initial products and restore local transactions if any
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const res = await authFetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          if (data.products && data.products.length > 0) {
            setProducts(data.products);

            // Populate inventory with store products if available
            setInventory(prev => {
              const merged = data.products.map(p => {
                const existing = prev.find(it => it.name.toLowerCase() === p.name.toLowerCase());
                return {
                  name: p.name,
                  unitPrice: Number(p.price) || 8.90,
                  prepared: existing ? existing.prepared : 40,
                  waste: existing ? existing.waste : 0,
                  image: p.image || null
                };
              });
              return merged.length > 0 ? merged : prev;
            });
          }
        }

        // Restore transactions from localStorage
        const cached = localStorage.getItem(storageKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.transactions) setTransactions(parsed.transactions);
            if (parsed.inventory) setInventory(parsed.inventory);
            if (parsed.boothTitle) setBoothTitle(parsed.boothTitle);
            if (parsed.boothExpenses) setBoothExpenses(parsed.boothExpenses);
          } catch (e) {
            console.warn('Failed to parse cached POS data:', e);
          }
        }
      } catch (err) {
        console.error('POS init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [authFetch, storageKey]);

  // Persist transactions and inventory
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          transactions,
          inventory,
          boothTitle,
          boothExpenses
        }));
      } catch (e) {
        // quota exceeded or private mode
      }
    }
  }, [transactions, inventory, boothTitle, boothExpenses, storageKey, loading]);

  // =========================================================================
  // Derived Real-Time Statistics
  // =========================================================================

  // Quantity sold per flavour calculated from transactions
  const soldByFlavour = useMemo(() => {
    const map = {};
    for (const tx of transactions) {
      for (const item of tx.items) {
        map[item.name] = (map[item.name] || 0) + Number(item.quantity);
      }
    }
    return map;
  }, [transactions]);

  // Overall Live Stats
  const liveStats = useMemo(() => {
    let grossSales = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let piecesSold = 0;
    let cashSales = 0;
    let qrSales = 0;
    let cardSales = 0;

    for (const tx of transactions) {
      grossSales += Number(tx.subtotal) || 0;
      totalDiscount += Number(tx.discount) || 0;
      netSales += Number(tx.total) || 0;

      for (const it of tx.items) {
        piecesSold += Number(it.quantity) || 0;
      }

      if (tx.paymentMethod === 'cash') cashSales += Number(tx.total) || 0;
      else if (tx.paymentMethod === 'qr') qrSales += Number(tx.total) || 0;
      else cardSales += Number(tx.total) || 0; // legacy transactions only
    }

    const expenseTotal = boothExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    return {
      grossSales,
      totalDiscount,
      netSales,
      piecesSold,
      orderCount: transactions.length,
      cashSales,
      qrSales,
      cardSales,
      expenseTotal,
      netProfit: netSales - expenseTotal
    };
  }, [transactions, boothExpenses]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [cart]);

  const cartDiscountAmount = useMemo(() => {
    if (cartSubtotal <= 0) return 0;

    if (discountType === '10') return Math.round(cartSubtotal * 10) / 100;

    if (discountType === 'custom') {
      const val = parseFloat(customDiscountValue);
      return isNaN(val) ? 0 : Math.min(cartSubtotal, Math.max(0, val));
    }

    return 0;
  }, [cartSubtotal, discountType, customDiscountValue]);

  const cartFinalTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - cartDiscountAmount);
  }, [cartSubtotal, cartDiscountAmount]);

  const cashChange = useMemo(() => {
    const received = parseFloat(cashReceived);
    if (isNaN(received) || received < cartFinalTotal) return 0;
    return Math.round((received - cartFinalTotal) * 100) / 100;
  }, [cashReceived, cartFinalTotal]);

  // Amount still owed when the customer hands over too little cash
  const cashShortfall = useMemo(() => {
    const received = parseFloat(cashReceived);
    if (isNaN(received) || received >= cartFinalTotal) return 0;
    return Math.round((cartFinalTotal - received) * 100) / 100;
  }, [cashReceived, cartFinalTotal]);

  // =========================================================================
  // Cart Actions
  // =========================================================================

  const handleAddToCart = (product) => {
    const currentSold = soldByFlavour[product.name] || 0;
    const remaining = (product.prepared || 0) - currentSold - (product.waste || 0);

    // In-cart quantity check
    const existingIndex = cart.findIndex(c => c.name === product.name);
    const inCartQty = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    if (inCartQty >= remaining) {
      toast.error(`【${product.name}】剩余库存不足，仅剩 ${remaining} 片`);
      return;
    }

    if (existingIndex > -1) {
      setCart(prev => prev.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart(prev => [
        ...prev,
        {
          name: product.name,
          unitPrice: product.unitPrice,
          quantity: 1
        }
      ]);
    }
  };

  const handleUpdateQty = (index, delta) => {
    setCart(prev => {
      const item = prev[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }

      // Check remaining stock
      const product = inventory.find(p => p.name === item.name);
      if (product) {
        const currentSold = soldByFlavour[product.name] || 0;
        const remaining = (product.prepared || 0) - currentSold - (product.waste || 0);
        if (newQty > remaining) {
          toast.error(`库存不足，仅剩 ${remaining} 片`);
          return prev;
        }
      }

      return prev.map((it, i) => i === index ? { ...it, quantity: newQty } : it);
    });
  };

  const handleRemoveFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
    setDiscountType('none');
    setCustomDiscountValue('');
    setCashReceived('');
    setOrderNote('');
  };

  // =========================================================================
  // Complete Order / Charge Transaction
  // =========================================================================
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('当前收银台为空，请先点击曲奇加入订单');
      return;
    }

    if (paymentMethod === 'cash' && cashReceived !== '') {
      const rec = parseFloat(cashReceived);
      if (!isNaN(rec) && rec < cartFinalTotal) {
        toast.error(`实收现金不足 (应收 ${money(cartFinalTotal)})`);
        return;
      }
    }

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);

    const newTx = {
      id: `POS-${Date.now()}`,
      orderNumber: `#${transactions.length + 1}`,
      time: timeStr,
      items: cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice
      })),
      subtotal: cartSubtotal,
      discount: cartDiscountAmount,
      discountType,
      total: cartFinalTotal,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? (parseFloat(cashReceived) || cartFinalTotal) : null,
      change: paymentMethod === 'cash' ? cashChange : null,
      note: orderNote.trim()
    };

    setTransactions(prev => [newTx, ...prev]);
    playCashChime();
    toast.success(`结账成功！实收 ${money(cartFinalTotal)}${cartDiscountAmount > 0 ? ` (已折 ${money(cartDiscountAmount)})` : ''}`);

    handleClearCart();
  };

  // Void / Cancel Mistaken Transaction
  const handleVoidTransaction = (txId) => {
    if (!confirm('确定要作废/撤销这笔收银订单吗？\n撤销后所售出曲奇将立即退回今日剩余库存中。')) return;
    setTransactions(prev => prev.filter(t => t.id !== txId));
    toast.info('该收银订单已作废撤销，库存已恢复');
  };

  // =========================================================================
  // Samples / Waste Tasting Recording
  // =========================================================================
  const handleRecordWaste = () => {
    if (!selectedWasteItem) return;
    const count = parseInt(wasteCountInput, 10);
    if (isNaN(count) || count <= 0) {
      toast.error('请输入有效的试吃/损耗片数');
      return;
    }

    setInventory(prev => prev.map(it => {
      if (it.name === selectedWasteItem.name) {
        return { ...it, waste: (it.waste || 0) + count };
      }
      return it;
    }));

    toast.success(`已记录【${selectedWasteItem.name}】试吃/损耗 ${count} 片`);
    setIsWasteModalOpen(false);
    setSelectedWasteItem(null);
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
  // Save & Settle Booth Session to business_records (Daily Settlement)
  // =========================================================================
  const handleSaveBoothSession = async () => {
    if (!boothTitle.trim()) {
      toast.error('请填写摆摊名称或地点');
      return;
    }

    if (transactions.length === 0) {
      if (!confirm('今日尚未产生任何 POS 收银订单，确定要保存今日摆摊准备记录吗？')) {
        return;
      }
    }

    setSavingSession(true);
    try {
      // Prepare normalized items for business_records
      const itemsPayload = inventory.map(item => {
        const sold = soldByFlavour[item.name] || 0;
        return {
          name: item.name,
          unitPrice: Number(item.unitPrice),
          prepared: Number(item.prepared) || 0,
          quantity: sold, // Exact cookies sold calculated by POS!
          waste: Number(item.waste) || 0,
        };
      });

      const payload = {
        channel: 'booth',
        date: boothDate,
        title: boothTitle.trim(),
        items: itemsPayload,
        discount: liveStats.totalDiscount, // Total discount given calculated by POS!
        received: liveStats.netSales, // Exact money received
        // Booth expenses are already saved in finance_records (成本支出). Do NOT copy them here,
        // otherwise the ledger deducts them twice. They are listed in the notes for reference only.
        expenses: [],
        notes: `POS收银系统日结自动生成。完成 ${liveStats.orderCount} 笔订单，售出 ${liveStats.piecesSold} 片曲奇。现金 ${money(liveStats.cashSales)} / QR ${money(liveStats.qrSales)}。${boothExpenses.length ? `现场支出(已记入成本支出): ${boothExpenses.map(e => `${e.description} ${money(e.amount)}`).join('、')}。` : ''}${boothNotes ? `备注: ${boothNotes}` : ''}`.slice(0, 1000)
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
        // If conflict with existing revision, fetch latest and save
        const errData = await res.json();
        throw new Error(errData.error || '保存出摊记录失败');
      }

      toast.success(`🎉 今日摆摊日结已成功保存！曲奇售出数量及折扣已自动录入流水账本！`);
    } catch (err) {
      toast.error(err.message || '保存日结出错');
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

  return (
    <div className={styles.posContainer}>
      {/* View Switch Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--color-text)' }}>
            🎪 摆摊智能收银系统 (Stall POS)
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-light)' }}>
            单点即售，自动累计曲奇售出数量与优惠折扣，无需收摊后手工计算。
          </p>
        </div>

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            className="btn"
            style={{
              padding: '7px 16px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: activeView === 'pos' ? 'white' : 'transparent',
              color: activeView === 'pos' ? 'var(--color-primary)' : 'var(--color-text-light)',
              boxShadow: activeView === 'pos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => setActiveView('pos')}
          >
            🛒 现场收银 POS
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '7px 16px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px',
              background: activeView === 'ledger' ? 'white' : 'transparent',
              color: activeView === 'ledger' ? 'var(--color-primary)' : 'var(--color-text-light)',
              boxShadow: activeView === 'ledger' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => setActiveView('ledger')}
          >
            📋 摆摊账本与历史
          </button>
        </div>
      </div>

      {activeView === 'ledger' ? (
        <BusinessChannel channel="booth" />
      ) : (
        <>
          {/* Booth Session Bar */}
          <div className={styles.sessionBar}>
            <div className={styles.sessionLeft}>
              <span className={styles.boothStatusBadge}>
                <span className={styles.statusDot}></span>
                现场营业中
              </span>

              <div className={styles.sessionInputs}>
                <input
                  type="date"
                  className={styles.sessionInput}
                  value={boothDate}
                  onChange={e => setBoothDate(e.target.value)}
                  title="出摊日期"
                />
                <input
                  type="text"
                  className={styles.sessionInput}
                  style={{ width: '220px' }}
                  placeholder="摆摊名称/地点 (如: 谷中城市集)"
                  value={boothTitle}
                  onChange={e => setBoothTitle(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.sessionActions}>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setIsPrepModalOpen(true)}
                title="设置今日各口味准备出摊数量"
              >
                ⚙️ 准备量设置
              </button>

              <button
                type="button"
                className={styles.btnAction}
                onClick={openExpenseModal}
                title="录入摊位租金、停车等现场费用并拍照"
              >
                🧾 现场支出 ({boothExpenses.length})
              </button>

              <button
                type="button"
                className={styles.btnSaveSettle}
                onClick={handleSaveBoothSession}
                disabled={savingSession}
                title="将自动统计的曲奇售出数量及折扣同步至业务账本"
              >
                {savingSession ? '⏳ 日结保存中...' : '💾 保存出摊日结'}
              </button>
            </div>
          </div>

          {/* Live Stats Bar */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>今日实收营业额</span>
              <strong className={styles.statValue} style={{ color: '#16a34a' }}>
                {money(liveStats.netSales)}
              </strong>
              <span className={styles.statSubtext}>原价 {money(liveStats.grossSales)}</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>总给出优惠折扣</span>
              <strong className={styles.statValue} style={{ color: '#ea580c' }}>
                {money(liveStats.totalDiscount)}
              </strong>
              <span className={styles.statSubtext}>自动逐笔累计</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>售出曲奇总数</span>
              <strong className={styles.statValue} style={{ color: 'var(--color-primary)' }}>
                {liveStats.piecesSold} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>片</span>
              </strong>
              <span className={styles.statSubtext}>已完成 {liveStats.orderCount} 笔收款</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>现场费用支出</span>
              <strong className={styles.statValue} style={{ color: liveStats.expenseTotal > 0 ? '#dc2626' : '#64748b' }}>
                {money(liveStats.expenseTotal)}
              </strong>
              <span className={styles.statSubtext}>摊位租金 / 现场杂费</span>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>摊位实得净利</span>
              <strong className={styles.statValue} style={{ color: liveStats.netProfit >= 0 ? '#059669' : '#dc2626' }}>
                {money(liveStats.netProfit)}
              </strong>
              <span className={styles.statSubtext}>营业额扣减现场支出</span>
            </div>
          </div>

          {/* Main POS Interface (Catalog Grid + Register) */}
          <div className={styles.posMain}>
            {/* Left: Product Selection Grid */}
            <div className={styles.catalogCard}>
              <div className={styles.catalogHeader}>
                <h2 className={styles.catalogTitle}>
                  <span>🍪 点击曲奇快速加入订单</span>
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                  共 {inventory.length} 种口味可选
                </span>
              </div>

              <div className={styles.productGrid}>
                {inventory.map((item, idx) => {
                  const sold = soldByFlavour[item.name] || 0;
                  const remaining = Math.max(0, (item.prepared || 0) - sold - (item.waste || 0));
                  const isSoldOut = remaining <= 0;
                  const inCartItem = cart.find(c => c.name === item.name);

                  return (
                    <div
                      key={item.name || idx}
                      className={`${styles.productTile} ${isSoldOut ? styles.productTileSoldOut : ''}`}
                      onClick={() => !isSoldOut && handleAddToCart(item)}
                      title={isSoldOut ? '此口味已售罄' : `点击添加 1 片 ${item.name}`}
                    >
                      {inCartItem && (
                        <span className={styles.tileBadgeAdded}>x{inCartItem.quantity}</span>
                      )}

                      <div className={styles.productIconBox}>
                        {item.image ? (
                          <img src={item.image} alt={item.name} />
                        ) : (
                          <span style={{ fontSize: '2.4rem' }}>🍪</span>
                        )}
                      </div>

                      <div className={styles.productTileName}>{item.name}</div>
                      <div className={styles.productTilePrice}>{money(item.unitPrice)}</div>

                      <div className={`${styles.productTileStock} ${remaining <= 5 ? styles.stockWarning : ''}`}>
                        {isSoldOut ? '🔴 已售罄' : `剩 ${remaining} 片 (备${item.prepared})`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: POS Cashier Register */}
            <div className={styles.registerCard}>
              <div className={styles.registerHeader}>
                <h3 className={styles.registerTitle}>
                  <span>🧾 当前收银台</span>
                  {cart.length > 0 && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                      ({cart.reduce((s, it) => s + it.quantity, 0)} 片)
                    </span>
                  )}
                </h3>

                {cart.length > 0 && (
                  <button type="button" className={styles.btnClearCart} onClick={handleClearCart}>
                    清空整单
                  </button>
                )}
              </div>

              {/* Cart List */}
              <div className={styles.cartList}>
                {cart.length === 0 ? (
                  <div className={styles.cartEmpty}>
                    <p style={{ margin: '0 0 4px', fontSize: '1.5rem' }}>🛒</p>
                    <strong>收银订单台就绪</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>点击左侧曲奇口味即可快速加单</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div className={styles.cartItem} key={item.name}>
                      <div className={styles.cartItemInfo}>
                        <div className={styles.cartItemName}>{item.name}</div>
                        <div className={styles.cartItemUnitPrice}>{money(item.unitPrice)} / 片</div>
                      </div>

                      <div className={styles.stepper}>
                        <button type="button" className={styles.stepperBtn} onClick={() => handleUpdateQty(idx, -1)}>
                          -
                        </button>
                        <span className={styles.stepperCount}>{item.quantity}</span>
                        <button type="button" className={styles.stepperBtn} onClick={() => handleUpdateQty(idx, 1)}>
                          +
                        </button>
                      </div>

                      <div className={styles.cartItemTotal}>
                        {money(item.quantity * item.unitPrice)}
                      </div>

                      <button
                        type="button"
                        className={styles.cartItemDelete}
                        onClick={() => handleRemoveFromCart(idx)}
                        title="移除此项"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Discounts Section */}
              <div className={styles.discountSection}>
                <div className={styles.discountHeader}>
                  <span>🏷️ 优惠与折扣设置</span>
                  {cartDiscountAmount > 0 && (
                    <strong style={{ color: '#ea580c' }}>- {money(cartDiscountAmount)}</strong>
                  )}
                </div>

                <div className={styles.discountChips}>
                  <button
                    type="button"
                    className={`${styles.discountChip} ${discountType === 'none' ? styles.discountChipActive : ''}`}
                    onClick={() => setDiscountType('none')}
                  >
                    无折扣
                  </button>
                  <button
                    type="button"
                    className={`${styles.discountChip} ${discountType === '10' ? styles.discountChipActive : ''}`}
                    onClick={() => setDiscountType('10')}
                  >
                    10% OFF
                  </button>
                  <button
                    type="button"
                    className={`${styles.discountChip} ${discountType === 'custom' ? styles.discountChipActive : ''}`}
                    onClick={() => setDiscountType('custom')}
                  >
                    自定义
                  </button>
                </div>

                {discountType === 'custom' && (
                  <div className={styles.customDiscountInput}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>立减金额: RM</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="如: 3.50"
                      value={customDiscountValue}
                      onChange={e => setCustomDiscountValue(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className={styles.paymentSection}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  💳 收款方式
                </div>

                <div className={styles.paymentTabs}>
                  <button
                    type="button"
                    className={`${styles.paymentTabBtn} ${paymentMethod === 'cash' ? styles.paymentTabBtnActive : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    💵 现金 Cash
                  </button>
                  <button
                    type="button"
                    className={`${styles.paymentTabBtn} ${paymentMethod === 'qr' ? styles.paymentTabBtnActive : ''}`}
                    onClick={() => { setPaymentMethod('qr'); setCashReceived(''); }}
                  >
                    📱 QR 转账
                  </button>
                </div>

                {paymentMethod === 'qr' && (
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                    顾客扫码付款后，直接点击「确认收款」记录即可。
                  </p>
                )}

                {/* Cash: amount given & change to return */}
                {paymentMethod === 'cash' && (
                  <div className={styles.cashBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>顾客给的现金 (RM):</span>
                      <div className={styles.cashChips}>
                        <button type="button" className={styles.cashChip} onClick={() => setCashReceived(cartFinalTotal.toFixed(2))}>
                          刚好
                        </button>
                        {[10, 20, 50, 100].map(v => (
                          <button key={v} type="button" className={styles.cashChip} onClick={() => setCashReceived(String(v))}>
                            RM{v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.cashRow}>
                      <input
                        id="pos-cash-received"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        placeholder={cartFinalTotal.toFixed(2)}
                        value={cashReceived}
                        onChange={e => setCashReceived(e.target.value)}
                        style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '110px', fontSize: '0.95rem', fontWeight: 700 }}
                      />
                      <div style={{ textAlign: 'right' }}>
                        {cashShortfall > 0 ? (
                          <>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>还差: </span>
                            <strong style={{ fontSize: '1.05rem', color: '#dc2626' }}>{money(cashShortfall)}</strong>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>需找零: </span>
                            <strong style={{ fontSize: '1.15rem', color: '#16a34a' }}>{money(cashChange)}</strong>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Notes (Optional) */}
              <div>
                <input
                  type="text"
                  placeholder="选填备注 (如：试吃回购 / 赠送包装盒)"
                  value={orderNote}
                  onChange={e => setOrderNote(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                />
              </div>

              {/* Totals Summary */}
              <div className={styles.totalsCard}>
                <div className={styles.totalRow}>
                  <span>曲奇原价小计</span>
                  <span>{money(cartSubtotal)}</span>
                </div>
                {cartDiscountAmount > 0 && (
                  <div className={styles.totalRow} style={{ color: '#ea580c' }}>
                    <span>优惠折扣扣减</span>
                    <span>- {money(cartDiscountAmount)}</span>
                  </div>
                )}
                <div className={styles.grandTotalRow}>
                  <span>应收总额</span>
                  <span className={styles.grandTotalAmount}>{money(cartFinalTotal)}</span>
                </div>
              </div>

              {/* Single Click Checkout Button */}
              <button
                type="button"
                className={styles.btnCharge}
                disabled={cart.length === 0}
                onClick={handleCheckout}
              >
                <span>💰 确认收款 {money(cartFinalTotal)} (完成此单)</span>
              </button>
            </div>
          </div>

          {/* Flavour Sales & Inventory Audit Table */}
          <div className={styles.auditCard}>
            <div className={styles.auditHeader}>
              <h3 className={styles.auditTitle}>
                <span>📊 今日各口味售出统计与库存表</span>
              </h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btnSecondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  onClick={() => setIsPrepModalOpen(true)}
                >
                  ⚙️ 调整准备量
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className={styles.auditTable}>
                <thead>
                  <tr>
                    <th>曲奇口味</th>
                    <th>单价</th>
                    <th>出摊准备量</th>
                    <th>已售出 (POS自动计算)</th>
                    <th>试吃 / 损耗</th>
                    <th>当前剩余库存</th>
                    <th>单项销售额</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item, idx) => {
                    const sold = soldByFlavour[item.name] || 0;
                    const waste = item.waste || 0;
                    const remaining = Math.max(0, (item.prepared || 0) - sold - waste);
                    const revenue = sold * item.unitPrice;

                    return (
                      <tr key={item.name || idx}>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>{money(item.unitPrice)}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{item.prepared || 0} 片</span>
                        </td>
                        <td>
                          <span className={styles.soldHighlight}>
                            ✓ {sold} 片
                          </span>
                        </td>
                        <td>{waste > 0 ? `${waste} 片` : '—'}</td>
                        <td>
                          <strong style={{ color: remaining <= 5 ? '#dc2626' : 'var(--color-text)' }}>
                            {remaining} 片
                          </strong>
                        </td>
                        <td>
                          <strong style={{ color: '#16a34a' }}>{money(revenue)}</strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btnSecondary"
                            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                            onClick={() => {
                              setSelectedWasteItem(item);
                              setIsWasteModalOpen(true);
                            }}
                            title="登记试吃赠送或损耗"
                          >
                            + 试吃/损耗
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Today's Transactions Feed */}
          <div className={styles.historyCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                🧾 今日收银订单流水 ({transactions.length} 笔)
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>
                倒序实时更新 · 可随时作废纠错
              </span>
            </div>

            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-light)', background: '#f8fafc', borderRadius: '10px' }}>
                今日暂未完成收银订单。在上方点单并点击「确认收款」后，流水将实时展示于此。
              </div>
            ) : (
              <div className={styles.historyList}>
                {transactions.map(tx => (
                  <div className={styles.historyItem} key={tx.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className={styles.historyOrderNum}>{tx.orderNumber}</span>
                      <div>
                        <div className={styles.historyItemsSummary}>
                          {tx.items.map(it => `${it.name} x${it.quantity}`).join('， ')}
                        </div>
                        <div className={styles.historyMeta}>
                          <span>🕒 {tx.time}</span>
                          <span>·</span>
                          <span>
                            {tx.paymentMethod === 'cash'
                              ? `💵 现金${tx.cashReceived ? ` 收 ${money(tx.cashReceived)} 找 ${money(tx.change || 0)}` : ''}`
                              : tx.paymentMethod === 'qr' ? '📱 QR' : '💳 刷卡'}
                          </span>
                          {tx.discount > 0 && (
                            <>
                              <span>·</span>
                              <span style={{ color: '#ea580c' }}>折让 {money(tx.discount)}</span>
                            </>
                          )}
                          {tx.note && (
                            <>
                              <span>·</span>
                              <span>备注: {tx.note}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div className={styles.historyAmount}>{money(tx.total)}</div>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#94a3b8', border: '1px solid #e2e8f0', background: 'white' }}
                        onClick={() => handleVoidTransaction(tx.id)}
                        title="作废撤销此单"
                      >
                        作废
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal: Setup Prep Stock */}
      <Modal
        isOpen={isPrepModalOpen}
        onClose={() => setIsPrepModalOpen(false)}
        title="⚙️ 设置出摊准备数量 (Daily Prep Stock)"
        maxWidth="520px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            出摊前录入每种曲奇带来的总片数。收银系统将以此作为基准，自动扣减售出并展示实时剩余库存。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '360px', overflowY: 'auto' }}>
            {inventory.map((item, idx) => (
              <div
                key={item.name}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              >
                <div>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>{item.name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)' }}>
                    单价: {money(item.unitPrice)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 700, textAlign: 'center' }}
                    value={item.prepared || 0}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setInventory(prev => prev.map((it, i) => i === idx ? { ...it, prepared: val } : it));
                    }}
                  />
                  <span style={{ fontSize: '0.82rem' }}>片</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btnPrimary" onClick={() => setIsPrepModalOpen(false)}>
              完成设置
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Record Sample/Waste */}
      <Modal
        isOpen={isWasteModalOpen}
        onClose={() => setIsWasteModalOpen(false)}
        title={`登记试吃 / 损耗 · ${selectedWasteItem?.name || ''}`}
        maxWidth="400px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            客户现场试吃或破碎损耗不计入销售额，但会从剩余库存中扣除。
          </p>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              试吃 / 损耗片数:
            </label>
            <input
              type="number"
              min="1"
              step="1"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700 }}
              value={wasteCountInput}
              onChange={e => setWasteCountInput(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn btnSecondary" onClick={() => setIsWasteModalOpen(false)}>
              取消
            </button>
            <button type="button" className="btn btnPrimary" onClick={handleRecordWaste}>
              确认扣减库存
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Record Booth Expense with Camera Photo Upload */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="🧾 录入摆摊现场支出 (自动同步至成本支出)"
        maxWidth="500px"
      >
        <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.8rem', color: '#166534' }}>
            💡 此处录入的摊位费、停车或物料支出将<strong>自动计入摆摊日结</strong>，并<strong>同步汇总至后台「成本支出」Tab</strong>！
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              支出品项说明 *
            </label>
            <input
              type="text"
              required
              placeholder="例如: 摊位租金 (2天) / 现场冰块 / 停车与油费"
              value={expenseForm.description}
              onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              金额 (RM) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="例如: 150.00"
              value={expenseForm.amount}
              onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              支付人 / 垫付方式
            </label>
            <select
              value={expenseForm.paid_by}
              onChange={e => setExpenseForm({ ...expenseForm, paid_by: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
            >
              <option value="公款账户">公款账户 (公款直接支付)</option>
              <option value="Shinnie">Shinnie 垫付 (待从公款报销)</option>
              <option value="Yunxuan">Yunxuan 垫付 (待从公款报销)</option>
            </select>
          </div>

          {/* Photo Snapshot & Upload Zone */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
              📷 现场拍照或上传收据凭证
            </label>
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '14px', textAlign: 'center', background: '#f8fafc' }}>
              <input
                type="file"
                id="boothExpensePhotoInput"
                accept="image/*"
                capture="environment"
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
              <label
                htmlFor="boothExpensePhotoInput"
                className="btn btnSecondary"
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {uploadingExpensePhoto ? '⏳ 正在上传中...' : '📷 点击调起相机拍照 / 上传图片'}
              </label>

              {expenseForm.receiptUrl && (
                <div style={{ marginTop: 10 }}>
                  <img src={receiptPreviewUrl(expenseForm.receiptUrl)} alt="凭证" style={{ maxHeight: '120px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btnSecondary" onClick={() => setIsExpenseModalOpen(false)} disabled={savingExpense}>
              取消
            </button>
            <button type="submit" className="btn btnPrimary" disabled={savingExpense || uploadingExpensePhoto}>
              {savingExpense ? '保存中...' : '确认录入'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
