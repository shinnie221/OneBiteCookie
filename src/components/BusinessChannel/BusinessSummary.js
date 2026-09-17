'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { businessDate, money, summarizeChannels } from '@/lib/business.mjs';
import styles from './BusinessChannel.module.css';

export default function BusinessSummary({ refreshVersion = 0 }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => `${businessDate().slice(0, 7)}-01`);
  const [to, setTo] = useState(() => businessDate());
  useEffect(() => {
    let active = true;
    Promise.all(['/api/orders', '/api/business'].map(async url => {
      const res = await authFetch(url);
      if (!res.ok) throw new Error('无法加载销售汇总简报。');
      return res.json();
    })).then(([orders, business]) => { if (active) { setData({ orders: orders.orders, records: business.records }); setError(''); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [authFetch, refreshVersion]);
  const valid = from && to && from <= to;
  const summary = data && valid ? summarizeChannels(data.orders, data.records, from, to) : null;
  return <section className={styles.page} aria-label="业务营收简报">
    <div className={styles.toolbar}><label>起始日期<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>结束日期<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
    {!valid && <p role="alert">请选择有效的日期范围（起始日期必须早于或等于结束日期）。</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!data && !error && <p>正在加载销售统计...</p>}
    {summary && <><div className={styles.totals}>
      <Link href="/staff/orders"><span>线上预购<strong>{money(summary.preorder)}</strong><small>已验证的官网预购订单</small></span></Link>
      <Link href="/staff/booth"><span>摆摊销售<strong>{money(summary.booth)}</strong><small>摆摊日销售额（折后）</small></span></Link>
      <Link href="/staff/wholesale"><span>批发供货<strong>{money(summary.wholesale)}</strong><small>供货订单总额（含未结清）</small></span></Link>
    </div><div className={styles.summaryFooter}><span>总销售额 <strong>{money(summary.total)}</strong></span><span>已记支出 <strong>{money(summary.expenses)}</strong></span><span>批发待收尾款 <strong>{money(summary.outstanding)}</strong></span></div>
      <details className={styles.hint}><summary>统计包含哪些数据？</summary><p>展示的支出为摆摊及批发业务中录入的各项费用。日期均采用马来西亚时间。如需查看各渠道完整明细、按日/月/年查询及导出 CSV 报表，请前往 <Link href="/staff/ledger">总结流水账本</Link>。</p></details>
    </>}
  </section>;
}
