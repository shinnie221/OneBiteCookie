'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';
import BusinessSummary from '@/components/BusinessChannel/BusinessSummary';

export default function DashboardPage() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('无法加载业务总览');
      const data = await res.json();
      setStats(data.stats);
    } catch {
      setError('无法加载业务总览，请重试。');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);
  // Load external API data; state updates occur after the request completes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading && !stats) return <LoadingSpinner text="正在加载业务总览..." />;
  const queue = stats?.recentOrders?.slice(0, 5) || [];
  const unavailable = stats?.unavailableProducts || [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>业务总览一览</p><h1>One Bite 业务总览</h1><p className={styles.subtitle}>集中掌握线上预购、线下摆摊与批发供货经营动态。</p></div>
        <button onClick={() => { setLoading(true); setError(''); setRefreshVersion(value => value + 1); fetchStats(); }} className="btn btnSecondary" disabled={loading}>{loading ? '刷新中...' : '刷新'}</button>
      </header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <BusinessSummary refreshVersion={refreshVersion} />
      {stats && <>
        <div className={styles.columns}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>线上预购待办队列</h2><p>{stats.pendingOrders} 笔待核验 · {stats.acceptedOrders} 笔制作中</p><p className={styles.queueSubtext}>按时间先后排序 · 显示最多 5 笔进行中的官网预购</p></div><Link href="/staff/orders" className="btn btnPrimary">管理预购订单</Link></div>
            {queue.length ? <ul className={styles.queue}>{queue.map(order => <li key={order.order_id}>
              <Link href={`/staff/orders?order=${encodeURIComponent(order.order_id)}`} className={styles.orderLink}>
                <div className={styles.orderInfo}><strong>{order.customer_name}</strong><span>#{order.order_id} · {order.order_type === 'delivery' ? '送货上门' : '自取'}</span></div>
                <div className={styles.orderStatus}><OrderStatusBadge status={order.order_status} /><span>查看订单 →</span></div>
              </Link>
            </li>)}</ul> : <div className={styles.empty}><strong>全部处理完毕</strong><p>当收到新的官网订单时，将自动显示在此处。</p></div>}
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>曲奇上架状态</h2><p>官网前台顾客可订购状态</p></div></div>
            <div className={styles.availability}>
              {unavailable.length ? <><strong>{unavailable.length} 款曲奇已下架 / 售罄</strong><ul>{unavailable.slice(0, 5).map(product => <li key={product.id}>{product.name}</li>)}</ul>{unavailable.length > 5 && <p>以及其他 {unavailable.length - 5} 款</p>}</> : <><span className={styles.good}>全部曲奇正常上架</span><p>全部口味菜单均处于可订购状态。</p></>}
              <Link href="/staff/products" className={styles.textLink}>前往管理曲奇菜单 →</Link>
            </div>
          </section>
        </div>
      </>}
    </div>
  );
}
