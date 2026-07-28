'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function DashboardPage() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await authFetch('/api/dashboard/stats');
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return <LoadingSpinner text="Loading dashboard..." />;
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard Overview</h1>
        <button onClick={fetchStats} className="btn btnSecondary">↻ Refresh</button>
      </div>

      <div className={styles.statsGrid}>
        <div className={`${styles.statCard} ${styles.primary}`}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statInfo}>
            <h3>Today's Sales</h3>
            <div className={styles.statValue}>RM{stats.todaySales.toFixed(2)}</div>
          </div>
        </div>
        
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statInfo}>
            <h3>Today's Orders</h3>
            <div className={styles.statValue}>{stats.todayOrders}</div>
          </div>
        </div>

        <div className={`${styles.statCard} ${stats.pendingOrders > 0 ? styles.warning : ''}`}>
          <div className={styles.statIcon}>⏳</div>
          <div className={styles.statInfo}>
            <h3>Pending Verification</h3>
            <div className={styles.statValue}>{stats.pendingOrders}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statInfo}>
            <h3>Accepted / Active</h3>
            <div className={styles.statValue}>{stats.acceptedOrders}</div>
          </div>
        </div>
      </div>

      <div className={styles.dashboardLayout}>
        <div className={styles.mainCol}>
          <div className={`card ${styles.recentOrdersCard}`}>
            <div className={styles.cardHeader}>
              <h2>Recent Orders</h2>
              <Link href="/staff/orders" className={styles.viewAll}>View All</Link>
            </div>
            
            <div className="tableWrapper">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Time</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="textCenter">No recent orders</td>
                    </tr>
                  ) : (
                    stats.recentOrders.map(order => (
                      <tr key={order.id}>
                        <td>{order.order_id}</td>
                        <td>{order.customer_name}</td>
                        <td>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>RM{order.total.toFixed(2)}</td>
                        <td><OrderStatusBadge status={order.order_status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={styles.sideCol}>
          <div className={`card ${styles.alertsCard}`}>
            <div className={styles.cardHeader}>
              <h2>Inventory Alerts</h2>
              <Link href="/staff/products" className={styles.viewAll}>Manage</Link>
            </div>
            
            <div className={styles.alertsList}>
              {stats.lowStockProducts.length === 0 ? (
                <div className={styles.emptyAlerts}>All products have sufficient stock.</div>
              ) : (
                stats.lowStockProducts.map(product => (
                  <div key={product.id} className={styles.alertItem}>
                    <div className={styles.alertIcon}>⚠️</div>
                    <div className={styles.alertContent}>
                      <h4>{product.name}</h4>
                      <p className={product.stock === 0 ? styles.textError : styles.textWarning}>
                        {product.stock === 0 ? 'Out of stock' : `Only ${product.stock} left`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className={`card ${styles.summaryCard} mt3`}>
             <div className={styles.cardHeader}>
              <h2>All Time</h2>
            </div>
            <div className={styles.summaryList}>
              <div className={styles.summaryItem}>
                <span>Total Revenue</span>
                <strong>RM{stats.totalSales.toFixed(2)}</strong>
              </div>
              <div className={styles.summaryItem}>
                <span>Total Completed</span>
                <strong>{stats.completedOrders} orders</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
