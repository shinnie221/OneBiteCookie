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
  const [from, setFrom] = useState(() => `${businessDate().slice(0, 7)}-01`);
  const [to, setTo] = useState(() => businessDate());
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
        <label className={styles.dateField}><span>起始</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <span className={styles.dateSeparator}>至</span>
        <label className={styles.dateField}><span>结束</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      </div>
      <a
        href="https://drive.google.com/drive/folders/1CxUKoiIQ5oicc6Eo-vun2pC0-2mG0joh?usp=sharing"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '0.78rem',
          color: '#1d4ed8',
          textDecoration: 'none',
          padding: '4px 8px',
          background: '#eff6ff',
          borderRadius: '6px',
          border: '1px solid #bfdbfe',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}
        title="在 Google Drive 中打开团队收据文件夹"
      >
        📂 收据云盘 ↗
      </a>
    </div>
    {!valid && <p className={styles.error} role="alert">请选择有效的日期范围（起始日期必须早于或等于结束日期）。</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!data && !error && <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>正在加载销售统计...</p>}
    {summary && <>
      <div className={styles.totalsGrid}>
        <Link href="/staff/orders" className={styles.channelCard}>
          <div className={styles.channelHeader}>
            <span className={styles.channelName}>线上预购</span>
            <span className={styles.channelIcon}>▤</span>
          </div>
          <strong className={styles.channelAmount}>{money(summary.preorder)}</strong>
          <small className={styles.channelSubtext}>已完成预购</small>
        </Link>
        <Link href="/staff/booth" className={styles.channelCard}>
          <div className={styles.channelHeader}>
            <span className={styles.channelName}>摆摊销售</span>
            <span className={styles.channelIcon}>⌂</span>
          </div>
          <strong className={styles.channelAmount}>{money(summary.booth)}</strong>
          <small className={styles.channelSubtext}>折后日销售</small>
        </Link>
        <Link href="/staff/wholesale" className={styles.channelCard}>
          <div className={styles.channelHeader}>
            <span className={styles.channelName}>批发供货</span>
            <span className={styles.channelIcon}>▥</span>
          </div>
          <strong className={styles.channelAmount}>{money(summary.wholesale)}</strong>
          <small className={styles.channelSubtext}>含待收尾款</small>
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
      <details className={styles.hint}>
        <summary>统计口径说明</summary>
        <p>展示线上已完成预购、摆摊、批发及原材料日常支出数据（马来西亚时间）。如需查看明细流水及导出 CSV，请前往 <Link href="/staff/ledger">总结流水账本</Link>。</p>
      </details>
    </>}
  </section>;
}
