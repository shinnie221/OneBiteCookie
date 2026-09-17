'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { businessDate, money } from '@/lib/business.mjs';
import styles from './page.module.css';

function getPreviousDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return businessDate(d);
}

function getPreviousMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function LedgerPage() {
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Date Mode state: 'daily' | 'monthly' | 'yearly' | 'custom'
  const today = businessDate();
  const yesterday = getPreviousDay(today);
  const thisMonth = today.slice(0, 7);
  const lastMonth = getPreviousMonth(thisMonth);
  const thisYear = today.slice(0, 4);
  const lastYear = String(Number(thisYear) - 1);

  const [mode, setMode] = useState('daily');
  const [dailyDate, setDailyDate] = useState(today);
  const [monthlyMonth, setMonthlyMonth] = useState(thisMonth);
  const [yearlyYear, setYearlyYear] = useState(thisYear);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  // Active channel tab: 'all' | 'orders' | 'booth' | 'wholesale'
  const [tab, setTab] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, businessRes] = await Promise.all([
        authFetch('/api/orders'),
        authFetch('/api/business')
      ]);

      if (!ordersRes.ok) throw new Error('无法加载线上预购订单数据');
      if (!businessRes.ok) throw new Error('无法加载摆摊与批发业务数据');

      const ordersData = await ordersRes.json();
      const businessData = await businessRes.json();

      setOrders(ordersData.orders || []);
      setRecords(businessData.records || []);
    } catch (err) {
      setError(err.message || '加载流水账本数据失败，请重试。');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute active date range [from, to]
  const { from, to, dateLabel } = useMemo(() => {
    if (mode === 'daily') {
      const label = dailyDate === today ? '今天' : dailyDate === yesterday ? '昨天' : dailyDate;
      return { from: dailyDate, to: dailyDate, dateLabel: `日流水 (${label})` };
    }
    if (mode === 'monthly') {
      const label = monthlyMonth === thisMonth ? '本月' : monthlyMonth === lastMonth ? '上月' : monthlyMonth;
      return { from: `${monthlyMonth}-01`, to: `${monthlyMonth}-31`, dateLabel: `月流水 (${label})` };
    }
    if (mode === 'yearly') {
      const label = yearlyYear === thisYear ? '本年' : yearlyYear === lastYear ? '去年' : yearlyYear;
      return { from: `${yearlyYear}-01-01`, to: `${yearlyYear}-12-31`, dateLabel: `年流水 (${label})` };
    }
    return { from: customFrom, to: customTo, dateLabel: `自定义区间 (${customFrom} 至 ${customTo})` };
  }, [mode, dailyDate, monthlyMonth, yearlyYear, customFrom, customTo, today, yesterday, thisMonth, lastMonth, thisYear, lastYear]);

  // Filter Online Orders
  const validOrderStatuses = useMemo(() => ['accepted', 'preparing', 'ready_pickup', 'out_delivery', 'completed'], []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (order.is_manual_order) return false;
      const orderDate = order.created_at ? businessDate(order.created_at) : '';
      return orderDate >= from && orderDate <= to;
    });
  }, [orders, from, to]);

  // Filter Booth records
  const filteredBooths = useMemo(() => {
    return records.filter(r => r.channel === 'booth' && r.date >= from && r.date <= to);
  }, [records, from, to]);

  // Filter Wholesale records
  const filteredWholesale = useMemo(() => {
    return records.filter(r => r.channel === 'wholesale' && r.date >= from && r.date <= to);
  }, [records, from, to]);

  // Calculations per channel
  const orderStats = useMemo(() => {
    const paidOrders = filteredOrders.filter(o => validOrderStatuses.includes(o.status));
    const totalSales = paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const totalPieces = paidOrders.reduce((sum, o) => sum + (o.items?.reduce((is, it) => is + (it.quantity || 0), 0) || 0), 0);
    return {
      count: filteredOrders.length,
      paidCount: paidOrders.length,
      sales: totalSales,
      pieces: totalPieces,
      expenses: 0,
      net: totalSales,
      outstanding: 0,
    };
  }, [filteredOrders, validOrderStatuses]);

  const boothStats = useMemo(() => {
    const sales = filteredBooths.reduce((sum, b) => sum + (b.sales || 0), 0);
    const expenses = filteredBooths.reduce((sum, b) => sum + (b.expenseTotal || 0), 0);
    const preparedPieces = filteredBooths.reduce((sum, b) => sum + b.items.reduce((is, it) => is + (it.prepared || 0), 0), 0);
    const soldPieces = filteredBooths.reduce((sum, b) => sum + b.items.reduce((is, it) => is + (it.quantity || 0), 0), 0);
    const wastePieces = filteredBooths.reduce((sum, b) => sum + b.items.reduce((is, it) => is + (it.waste || 0), 0), 0);
    return {
      count: filteredBooths.length,
      sales,
      expenses,
      net: sales - expenses,
      preparedPieces,
      pieces: soldPieces,
      wastePieces,
      outstanding: 0,
    };
  }, [filteredBooths]);

  const wholesaleStats = useMemo(() => {
    const sales = filteredWholesale.reduce((sum, w) => sum + (w.sales || 0), 0);
    const received = filteredWholesale.reduce((sum, w) => sum + (w.received || 0), 0);
    const outstanding = filteredWholesale.reduce((sum, w) => sum + (w.outstanding || 0), 0);
    const expenses = filteredWholesale.reduce((sum, w) => sum + (w.expenseTotal || 0), 0);
    const pieces = filteredWholesale.reduce((sum, w) => sum + w.items.reduce((is, it) => is + (it.quantity || 0), 0), 0);
    return {
      count: filteredWholesale.length,
      sales,
      received,
      outstanding,
      expenses,
      net: sales - expenses,
      pieces,
    };
  }, [filteredWholesale]);

  // Combined Totals
  const combinedStats = useMemo(() => {
    const totalSales = orderStats.sales + boothStats.sales + wholesaleStats.sales;
    const totalExpenses = boothStats.expenses + wholesaleStats.expenses;
    const netRevenue = totalSales - totalExpenses;
    const totalPieces = orderStats.pieces + boothStats.pieces + wholesaleStats.pieces;
    const totalOutstanding = wholesaleStats.outstanding;
    const totalCount = orderStats.count + boothStats.count + wholesaleStats.count;
    return {
      sales: totalSales,
      expenses: totalExpenses,
      net: netRevenue,
      pieces: totalPieces,
      outstanding: totalOutstanding,
      count: totalCount,
    };
  }, [orderStats, boothStats, wholesaleStats]);

  // Unified Chronological Stream for 'all' tab
  const unifiedStream = useMemo(() => {
    const stream = [];

    // Orders
    for (const o of filteredOrders) {
      const orderDate = o.created_at ? businessDate(o.created_at) : '';
      const pieces = o.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;
      const isPaid = validOrderStatuses.includes(o.status);
      stream.push({
        id: `order-${o.order_id}`,
        type: 'orders',
        typeLabel: '线上预购',
        date: orderDate,
        title: `订单 #${o.order_id.slice(-6).toUpperCase()} · ${o.customer_name || '顾客'}`,
        subtext: `${o.delivery_method === 'delivery' ? '🚚 送货' : '🛍️ 自取'} · ${pieces} 片曲奇 · ${o.customer_phone || ''}`,
        pieces,
        gross: Number(o.total_amount) || 0,
        sales: isPaid ? Number(o.total_amount) || 0 : 0,
        expenses: 0,
        net: isPaid ? Number(o.total_amount) || 0 : 0,
        statusText: isPaid ? '已核验付款' : '待付款/未生效',
        raw: o,
      });
    }

    // Booth
    for (const b of filteredBooths) {
      const sold = b.items.reduce((s, it) => s + (it.quantity || 0), 0);
      const prep = b.items.reduce((s, it) => s + (it.prepared || 0), 0);
      const isPrep = b.status === 'preparing';
      stream.push({
        id: `booth-${b.id}`,
        type: 'booth',
        typeLabel: '摆摊销售',
        date: b.date,
        title: `市集摆摊 · ${b.title}`,
        subtext: isPrep ? `出摊准备 ${prep} 片 (进行中待结单)` : `售出 ${sold} 片 · 准备 ${prep} 片 · 支出 ${money(b.expenseTotal)}`,
        pieces: sold,
        gross: b.grossSales || 0,
        sales: b.sales || 0,
        expenses: b.expenseTotal || 0,
        net: (b.sales || 0) - (b.expenseTotal || 0),
        statusText: isPrep ? '⏳ 摆摊中' : '✅ 已结单',
        raw: b,
      });
    }

    // Wholesale
    for (const w of filteredWholesale) {
      const pieces = w.items.reduce((s, it) => s + (it.quantity || 0), 0);
      stream.push({
        id: `wholesale-${w.id}`,
        type: 'wholesale',
        typeLabel: '批发供货',
        date: w.date,
        title: `批发合作 · ${w.title}`,
        subtext: `供货 ${pieces} 片 · 已收 ${money(w.received)} · 尚欠 ${money(w.outstanding)}`,
        pieces,
        gross: w.grossSales || 0,
        sales: w.sales || 0,
        expenses: w.expenseTotal || 0,
        net: (w.sales || 0) - (w.expenseTotal || 0),
        statusText: w.outstanding > 0 ? `待收 ${money(w.outstanding)}` : '已结清',
        raw: w,
      });
    }

    return stream.sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredOrders, filteredBooths, filteredWholesale, validOrderStatuses]);

  // CSV Export
  const exportCSV = () => {
    const cleanCSV = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const lines = [];

    // Header
    lines.push(['One Bite 手工曲奇 - 总结流水账本报表']);
    lines.push(['统计维度', dateLabel]);
    lines.push(['统计时间区间', `${from} 至 ${to}`]);
    lines.push(['报表导出时间', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Kuala_Lumpur' })]);
    lines.push([]);

    // Part 1: KPI Summary
    lines.push(['【一、全渠道财务综合汇总】']);
    lines.push(['销售渠道', '交易笔数/场次', '售出总片数', '销售营业额 (RM)', '已记支出 (RM)', '净营业额 (RM)', '待收尾款 (RM)'].map(cleanCSV).join(','));
    lines.push(['线上预购', orderStats.count, orderStats.pieces, orderStats.sales.toFixed(2), '0.00', orderStats.net.toFixed(2), '0.00'].map(cleanCSV).join(','));
    lines.push(['摆摊销售', boothStats.count, boothStats.pieces, boothStats.sales.toFixed(2), boothStats.expenses.toFixed(2), boothStats.net.toFixed(2), '0.00'].map(cleanCSV).join(','));
    lines.push(['批发供货', wholesaleStats.count, wholesaleStats.pieces, wholesaleStats.sales.toFixed(2), wholesaleStats.expenses.toFixed(2), wholesaleStats.net.toFixed(2), wholesaleStats.outstanding.toFixed(2)].map(cleanCSV).join(','));
    lines.push(['全渠道总计', combinedStats.count, combinedStats.pieces, combinedStats.sales.toFixed(2), combinedStats.expenses.toFixed(2), combinedStats.net.toFixed(2), combinedStats.outstanding.toFixed(2)].map(cleanCSV).join(','));
    lines.push([]);

    // Part 2: Online Orders Detail
    lines.push(['【二、线上预购明细清单】']);
    lines.push(['订单编号', '订购日期', '顾客姓名', '联系电话', '配送方式', '预取/配送日期', '曲奇总片数', '订单金额 (RM)', '核验状态'].map(cleanCSV).join(','));
    for (const o of filteredOrders) {
      const orderDate = o.created_at ? businessDate(o.created_at) : '';
      const pieces = o.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;
      const isPaid = validOrderStatuses.includes(o.status);
      lines.push([
        o.order_id,
        orderDate,
        o.customer_name || '',
        o.customer_phone || '',
        o.delivery_method === 'delivery' ? '送货上门' : '自取',
        o.delivery_date || '',
        pieces,
        (Number(o.total_amount) || 0).toFixed(2),
        isPaid ? '已核验入账' : '待确认/未入账'
      ].map(cleanCSV).join(','));
    }
    lines.push([]);

    // Part 3: Booth Sales Detail
    lines.push(['【三、摆摊销售明细清单】']);
    lines.push(['摆摊日期', '市集/地点名称', '状态', '准备出摊片数', '实际售出片数', '试吃损耗片数', '结余库存片数', '销售额 (RM)', '现场支出费用 (RM)', '净利润 (RM)', '备注'].map(cleanCSV).join(','));
    for (const b of filteredBooths) {
      const prep = b.items.reduce((s, it) => s + (it.prepared || 0), 0);
      const sold = b.items.reduce((s, it) => s + (it.quantity || 0), 0);
      const waste = b.items.reduce((s, it) => s + (it.waste || 0), 0);
      const leftover = prep - sold - waste;
      lines.push([
        b.date,
        b.title,
        b.status === 'preparing' ? '摆摊中(待结单)' : '已结单',
        prep,
        sold,
        waste,
        leftover,
        (b.sales || 0).toFixed(2),
        (b.expenseTotal || 0).toFixed(2),
        ((b.sales || 0) - (b.expenseTotal || 0)).toFixed(2),
        b.notes || ''
      ].map(cleanCSV).join(','));
    }
    lines.push([]);

    // Part 4: Wholesale Detail
    lines.push(['【四、批发供货明细清单】']);
    lines.push(['订单日期', '合作批发商', '联系方式', '订购片数', '供货总额 (RM)', '已收金额 (RM)', '待收尾款 (RM)', '相关支出 (RM)', '备注'].map(cleanCSV).join(','));
    for (const w of filteredWholesale) {
      const pieces = w.items.reduce((s, it) => s + (it.quantity || 0), 0);
      lines.push([
        w.date,
        w.title,
        w.contact || '',
        pieces,
        (w.sales || 0).toFixed(2),
        (w.received || 0).toFixed(2),
        (w.outstanding || 0).toFixed(2),
        (w.expenseTotal || 0).toFixed(2),
        w.notes || ''
      ].map(cleanCSV).join(','));
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `one-bite-总结流水账本-${from}_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>财务中心</p>
          <h1>总结流水账本</h1>
          <p>整合全渠道销售流水（线上预购、市集摆摊、批发供货），支持日/月/年多维度核算及报表导出。</p>
        </div>
        <button type="button" className={styles.exportBtn} onClick={exportCSV} disabled={loading}>
          📥 导出当前报表 (CSV)
        </button>
      </header>

      {error && <div className={styles.errorBanner} role="alert">{error}</div>}

      {/* Date Control Panel */}
      <section className={styles.controlPanel} aria-label="账本筛选控制区">
        {/* Mode switcher */}
        <div className={styles.modeSwitcher} role="tablist" aria-label="时间维度切换">
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'daily' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('daily')}
          >
            日流水 (Daily)
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'monthly' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('monthly')}
          >
            月流水 (Monthly)
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'yearly' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('yearly')}
          >
            年流水 (Yearly)
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'custom' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('custom')}
          >
            自定义区间
          </button>
        </div>

        {/* Dynamic Date Pickers & Quick Buttons */}
        <div className={styles.dateToolbar}>
          <div className={styles.quickButtons}>
            {mode === 'daily' && (
              <>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => setDailyDate(today)}
                >
                  📅 今天 (Today)
                </button>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => setDailyDate(yesterday)}
                >
                  ⏪ 昨天 (Previous Day)
                </button>
              </>
            )}

            {mode === 'monthly' && (
              <>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => setMonthlyMonth(thisMonth)}
                >
                  📅 本月 (This Month)
                </button>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => setMonthlyMonth(lastMonth)}
                >
                  ⏪ 上月 (Last Month)
                </button>
              </>
            )}

            {mode === 'yearly' && (
              <>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => setYearlyYear(thisYear)}
                >
                  📅 本年 (This Year)
                </button>
                <button
                  type="button"
                  className={styles.quickBtn}
                  onClick={() => setYearlyYear(lastYear)}
                >
                  ⏪ 去年 (Last Year)
                </button>
              </>
            )}
          </div>

          <div className={styles.dateInputs}>
            {mode === 'daily' && (
              <label>
                选择日期：
                <input
                  type="date"
                  value={dailyDate}
                  onChange={e => setDailyDate(e.target.value)}
                />
              </label>
            )}

            {mode === 'monthly' && (
              <label>
                选择月份：
                <input
                  type="month"
                  value={monthlyMonth}
                  onChange={e => setMonthlyMonth(e.target.value)}
                />
              </label>
            )}

            {mode === 'yearly' && (
              <label>
                选择年份：
                <select
                  value={yearlyYear}
                  onChange={e => setYearlyYear(e.target.value)}
                >
                  {Array.from({ length: 7 }, (_, i) => String(Number(thisYear) - i)).map(y => (
                    <option key={y} value={y}>{y} 年</option>
                  ))}
                </select>
              </label>
            )}

            {mode === 'custom' && (
              <>
                <label>
                  起始：
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                  />
                </label>
                <label>
                  结束：
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                  />
                </label>
              </>
            )}

            <button type="button" className="btn btnSecondary" onClick={loadData}>
              ↻ 刷新
            </button>
          </div>
        </div>
      </section>

      {/* KPI Grid */}
      <section className={styles.kpiGrid} aria-label="全渠道财务指标">
        <div className={`${styles.kpiCard} ${styles.kpiPrimary}`}>
          <span>全渠道总销售额</span>
          <strong>{money(combinedStats.sales)}</strong>
          <small>售出曲奇共 {combinedStats.pieces} 片 · {combinedStats.count} 笔交易/场次</small>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiWarning}`}>
          <span>已记支出费用</span>
          <strong>{money(combinedStats.expenses)}</strong>
          <small>摆摊现场开销与批发物流相关支出</small>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiSuccess}`}>
          <span>全店净营业额</span>
          <strong>{money(combinedStats.net)}</strong>
          <small>总销售额扣除已记支出后的净收入</small>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiInfo}`}>
          <span>批发待收尾款</span>
          <strong>{money(combinedStats.outstanding)}</strong>
          <small>各合作批发商应收账款</small>
        </div>
      </section>

      {/* Secondary Channels Breakdown Pills */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '.88rem' }}>
        <div style={{ background: '#eff6ff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
          <strong>线上预购：</strong> {money(orderStats.sales)} ({orderStats.pieces} 片 · {orderStats.paidCount} 单生效)
        </div>
        <div style={{ background: '#fef3c7', padding: '8px 16px', borderRadius: '8px', border: '1px solid #fde68a' }}>
          <strong>摆摊销售：</strong> {money(boothStats.sales)} ({boothStats.pieces} 片售出 · {boothStats.count} 场市集)
        </div>
        <div style={{ background: '#f3e8ff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
          <strong>批发供货：</strong> {money(wholesaleStats.sales)} ({wholesaleStats.pieces} 片 · {wholesaleStats.count} 笔订单)
        </div>
      </div>

      {/* Channel View Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'all' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('all')}
        >
          全部渠道综合流水 ({unifiedStream.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'orders' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('orders')}
        >
          线上预购流水 ({filteredOrders.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'booth' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('booth')}
        >
          摆摊销售流水 ({filteredBooths.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'wholesale' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('wholesale')}
        >
          批发供货流水 ({filteredWholesale.length})
        </button>
      </div>

      {/* Table Card */}
      <section className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2>{dateLabel} · {tab === 'all' ? '综合流水明细' : tab === 'orders' ? '线上预购明细' : tab === 'booth' ? '摆摊销售明细' : '批发供货明细'}</h2>
          <span className={styles.hint}>展示马来西亚时间交易数据</span>
        </div>

        {loading ? (
          <div className={styles.emptyState}>正在加载流水数据...</div>
        ) : (
          <>
            {/* View 1: ALL */}
            {tab === 'all' && (
              unifiedStream.length === 0 ? (
                <div className={styles.emptyState}>当前时间段内暂无任何渠道交易记录。</div>
              ) : (
                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>渠道</th>
                      <th>交易明细 / 名称</th>
                      <th>售出片数</th>
                      <th>销售额</th>
                      <th>支出</th>
                      <th>净额</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedStream.map(row => (
                      <tr key={row.id}>
                        <td><strong>{row.date}</strong></td>
                        <td>
                          <span className={row.type === 'orders' ? styles.badgeOrder : row.type === 'booth' ? styles.badgeBooth : styles.badgeWholesale}>
                            {row.typeLabel}
                          </span>
                        </td>
                        <td>
                          <strong>{row.title}</strong>
                          <div className={styles.hint}>{row.subtext}</div>
                        </td>
                        <td>{row.pieces} 片</td>
                        <td><strong>{money(row.sales)}</strong></td>
                        <td>{row.expenses > 0 ? money(row.expenses) : '—'}</td>
                        <td style={{ color: row.net > 0 ? '#16a34a' : 'inherit' }}>
                          <strong>{money(row.net)}</strong>
                        </td>
                        <td><small>{row.statusText}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {/* View 2: ONLINE ORDERS */}
            {tab === 'orders' && (
              filteredOrders.length === 0 ? (
                <div className={styles.emptyState}>当前时间段内暂无线上预购订单。</div>
              ) : (
                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th>订购日期</th>
                      <th>订单编号</th>
                      <th>顾客信息</th>
                      <th>预取/配送</th>
                      <th>曲奇总件数</th>
                      <th>订单金额</th>
                      <th>核验状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map(order => {
                      const isPaid = validOrderStatuses.includes(order.status);
                      const pieces = order.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0;
                      return (
                        <tr key={order.order_id}>
                          <td>{order.created_at ? businessDate(order.created_at) : '—'}</td>
                          <td><strong>#{order.order_id.slice(-6).toUpperCase()}</strong></td>
                          <td>
                            <strong>{order.customer_name || '顾客'}</strong>
                            <div className={styles.hint}>{order.customer_phone || ''}</div>
                          </td>
                          <td>
                            <span>{order.delivery_method === 'delivery' ? '🚚 送货' : '🛍️ 自取'}</span>
                            <div className={styles.hint}>{order.delivery_date || '未定日期'}</div>
                          </td>
                          <td>{pieces} 片</td>
                          <td><strong>{money(order.total_amount)}</strong></td>
                          <td>
                            <span style={{ color: isPaid ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                              {isPaid ? '已核验入账' : '待核验/未入账'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* View 3: BOOTH */}
            {tab === 'booth' && (
              filteredBooths.length === 0 ? (
                <div className={styles.emptyState}>当前时间段内暂无摆摊销售记录。</div>
              ) : (
                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th>摆摊日期</th>
                      <th>市集地点</th>
                      <th>准备片数</th>
                      <th>售出片数</th>
                      <th>损耗</th>
                      <th>销售额</th>
                      <th>现场支出</th>
                      <th>净营业额</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBooths.map(b => {
                      const prep = b.items.reduce((s, it) => s + (it.prepared || 0), 0);
                      const sold = b.items.reduce((s, it) => s + (it.quantity || 0), 0);
                      const waste = b.items.reduce((s, it) => s + (it.waste || 0), 0);
                      const isPrep = b.status === 'preparing';
                      return (
                        <tr key={b.id}>
                          <td><strong>{b.date}</strong></td>
                          <td><strong>{b.title}</strong></td>
                          <td>{prep} 片</td>
                          <td><strong>{sold} 片</strong></td>
                          <td>{waste} 片</td>
                          <td><strong>{money(b.sales)}</strong></td>
                          <td>{b.expenseTotal > 0 ? money(b.expenseTotal) : '—'}</td>
                          <td style={{ color: '#16a34a' }}><strong>{money((b.sales || 0) - (b.expenseTotal || 0))}</strong></td>
                          <td>
                            <span className={isPrep ? styles.badgeBooth : styles.badgeOrder}>
                              {isPrep ? '⏳ 摆摊中(待结单)' : '✅ 已结单'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {/* View 4: WHOLESALE */}
            {tab === 'wholesale' && (
              filteredWholesale.length === 0 ? (
                <div className={styles.emptyState}>当前时间段内暂无批发供货记录。</div>
              ) : (
                <table className={styles.ledgerTable}>
                  <thead>
                    <tr>
                      <th>订单日期</th>
                      <th>合作批发商</th>
                      <th>联系方式</th>
                      <th>供货片数</th>
                      <th>订单总额</th>
                      <th>已收金额</th>
                      <th>待收尾款</th>
                      <th>运费支出</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWholesale.map(w => {
                      const pieces = w.items.reduce((s, it) => s + (it.quantity || 0), 0);
                      return (
                        <tr key={w.id}>
                          <td><strong>{w.date}</strong></td>
                          <td><strong>{w.title}</strong></td>
                          <td>{w.contact || '—'}</td>
                          <td>{pieces} 片</td>
                          <td><strong>{money(w.sales)}</strong></td>
                          <td>{money(w.received)}</td>
                          <td>
                            <span style={{ color: w.outstanding > 0 ? '#ea580c' : '#16a34a', fontWeight: 600 }}>
                              {w.outstanding > 0 ? money(w.outstanding) : '已结清'}
                            </span>
                          </td>
                          <td>{w.expenseTotal > 0 ? money(w.expenseTotal) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </>
        )}
      </section>
    </div>
  );
}
