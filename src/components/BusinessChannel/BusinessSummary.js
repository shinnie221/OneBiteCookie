'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { businessDate, money, summarizeChannels } from '@/lib/business.mjs';
import styles from './BusinessSummary.module.css';

export default function BusinessSummary({ refreshVersion = 0 }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const today = businessDate();
  const thisMonthStart = `${today.slice(0, 7)}-01`;
  const thisMonthEnd = `${today.slice(0, 7)}-31`;
  const [from, setFrom] = useState(() => thisMonthStart);
  const [to, setTo] = useState(() => today);
  useEffect(() => {
    let active = true;
    Promise.all(['/api/orders', '/api/business', '/api/finance'].map(async url => {
      const res = await authFetch(url);
      if (!res.ok) throw new Error('无法加载销售汇总简报。');
      return res.json();
    })).then(([orders, business, finance]) => {
      if (active) {
        setData({ orders: orders.orders, records: business.records, finance: finance.records });
        setError('');
      }
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [authFetch, refreshVersion]);
  const valid = from && to && from <= to;
  const summary = data && valid ? summarizeChannels(data.orders, data.records, from, to, data.finance) : null;
  return <section className={styles.summarySection} aria-label="业务营收简报">
    <div className={styles.summaryToolbar}>
      <div className={styles.dateRangePicker}>
        <div className={styles.quickButtons}>
          <button
            type="button"
            className={`${styles.quickBtn} ${from === today && to === today ? styles.quickBtnActive : ''}`}
            onClick={() => { setFrom(today); setTo(today); }}
            title="查看今日营收，与总结流水账本日流水对齐"
          >
            今日
          </button>
          <button
            type="button"
            className={`${styles.quickBtn} ${from === thisMonthStart && to === today ? styles.quickBtnActive : ''}`}
            onClick={() => { setFrom(thisMonthStart); setTo(today); }}
            title="查看本月1号至今天的累计营收"
          >
            本月至今
          </button>
          <button
            type="button"
            className={`${styles.quickBtn} ${from === thisMonthStart && to === thisMonthEnd ? styles.quickBtnActive : ''}`}
            onClick={() => { setFrom(thisMonthStart); setTo(thisMonthEnd); }}
            title="查看本月整月营收，与总结流水账本月流水对齐"
          >
            本月整月
          </button>
        </div>
        <label className={styles.dateField}><span>起始</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <span className={styles.dateSeparator}>至</span>
        <label className={styles.dateField}><span>结束</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      </div>
      <Link href="/staff/ledger" className={styles.ledgerLink} title="前往查看流水账证明细与渠道明细">
        前往总结流水账本 →
      </Link>
    </div>
    {!valid && <p className={styles.error} role="alert">请选择有效的日期范围（起始日期必须早于或等于结束日期）。</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!data && !error && <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>正在加载销售统计...</p>}
    {summary && <>
      <div className={styles.totalsGrid}>
        <Link href="/staff/orders" className={styles.channelCard} title="线上商城已完成曲奇销售（已扣除配送费）">
          <div className={styles.channelHeader}>
            <span className={styles.channelName}>线上预购 (曲奇)</span>
          </div>
          <strong className={styles.channelAmount}>{money(summary.preorder)}</strong>
        </Link>
        {summary.deliveryIncome > 0 && (
          <Link href="/staff/expenses" className={styles.channelCard} title="Lalamove 等配送收入（合伙公款入账）">
            <div className={styles.channelHeader}>
              <span className={styles.channelName}>配送收入</span>
            </div>
            <strong className={styles.channelAmount}>{money(summary.deliveryIncome)}</strong>
          </Link>
        )}
        <Link href="/staff/booth" className={styles.channelCard}>
          <div className={styles.channelHeader}>
            <span className={styles.channelName}>摆摊销售</span>
          </div>
          <strong className={styles.channelAmount}>{money(summary.booth)}</strong>
        </Link>
        <Link href="/staff/wholesale" className={styles.channelCard}>
          <div className={styles.channelHeader}>
            <span className={styles.channelName}>批发供货</span>
          </div>
          <strong className={styles.channelAmount}>{money(summary.wholesale)}</strong>
        </Link>
      </div>
      <div className={styles.summaryFooter}>
        <div className={styles.footerItem}>
          <span>总销售额</span>
          <strong className={styles.footerHighlight}>{money(summary.total)}</strong>
        </div>
        <Link href="/staff/expenses" className={styles.footerItem} style={{ color: 'inherit', textDecoration: 'none' }} title="点击前往管理原材料与日常成本支出">
          <span>已记支出</span>
          <strong style={{ textDecoration: 'underline' }}>{money(summary.expenses)}</strong>
        </Link>
        <div className={styles.footerItem}>
          <span>净营业额</span>
          <strong style={{ color: summary.net >= 0 ? '#16a34a' : '#dc2626' }}>{money(summary.net)}</strong>
        </div>
        <div className={styles.footerItem}>
          <span>待收尾款</span>
          <strong>{money(summary.outstanding)}</strong>
        </div>
      </div>
    </>}
  </section>;
}
