'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function DashboardPage() {
  const { authFetch } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Quick action modal for pending orders
  const [actionOrderId, setActionOrderId] = useState(null);
  const [actionOrder, setActionOrder] = useState(null);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
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

  const handlePendingClick = (order) => {
    setActionOrder(order);
    setActionOrderId(order.order_id);
    setShowDenyForm(false);
    setDenyReason('');
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/orders/${actionOrder.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'verified', order_status: 'preparing' })
      });
      if (res.ok) {
        toast.success('Order accepted & preparing');
        setActionOrderId(null);
        setActionOrder(null);
        fetchStats();
      } else {
        toast.error('Failed to accept order');
      }
    } catch {
      toast.error('Error accepting order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/orders/${actionOrder.order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: 'rejected', order_status: 'rejected', reject_reason: denyReason.trim() })
      });
      if (res.ok) {
        toast.success('Order denied');
        setActionOrderId(null);
        setActionOrder(null);
        setShowDenyForm(false);
        setDenyReason('');
        fetchStats();
      } else {
        toast.error('Failed to deny order');
      }
    } catch {
      toast.error('Error denying order');
    } finally {
      setActionLoading(false);
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
              <h2>Current Orders</h2>
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
                      <td colSpan="5" className="textCenter">No active orders</td>
                    </tr>
                  ) : (
                    stats.recentOrders.map(order => (
                      <tr 
                        key={order.id}
                        className={order.order_status === 'pending_verification' ? styles.pendingRow : ''}
                        style={order.order_status === 'pending_verification' ? { cursor: 'pointer' } : {}}
                        onClick={() => {
                          if (order.order_status === 'pending_verification') {
                            handlePendingClick(order);
                          }
                        }}
                      >
                        <td>{order.order_id}</td>
                        <td>{order.customer_name}</td>
                        <td>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td>RM{order.total.toFixed(2)}</td>
                        <td>
                          <OrderStatusBadge status={order.order_status} />
                          {order.order_status === 'pending_verification' && (
                            <span className={styles.clickHint}>Click to process</span>
                          )}
                        </td>
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

      {/* Quick Action Modal for Pending Orders */}
      {actionOrderId && (
        <div className={styles.quickActionOverlay} onClick={() => { setActionOrderId(null); setShowDenyForm(false); }}>
          <div className={styles.quickActionCard} onClick={e => e.stopPropagation()}>
            <div className={styles.quickActionHeader}>
              <h3>Process Order #{actionOrder?.order_id}</h3>
              <button className={styles.quickActionClose} onClick={() => { setActionOrderId(null); setShowDenyForm(false); }}>✕</button>
            </div>
            
            <div className={styles.quickActionBody}>
              <div className={styles.quickActionInfo}>
                <p><strong>Customer:</strong> {actionOrder?.customer_name}</p>
                <p><strong>Phone:</strong> {actionOrder?.phone}</p>
                <p><strong>Total:</strong> RM{actionOrder?.total?.toFixed(2)}</p>
                <p><strong>Type:</strong> {actionOrder?.order_type === 'delivery' ? '🚚 Delivery' : '🛍️ Pickup'}</p>
              </div>

              {!showDenyForm ? (
                <div className={styles.quickActionButtons}>
                  <button 
                    className={styles.btnQuickAccept}
                    onClick={handleAccept}
                    disabled={actionLoading}
                  >
                    {actionLoading ? '...' : '✓ Accept & Start Preparing'}
                  </button>
                  <button 
                    className={styles.btnQuickDeny}
                    onClick={() => setShowDenyForm(true)}
                    disabled={actionLoading}
                  >
                    ✕ Deny Order
                  </button>
                  <Link 
                    href="/staff/orders"
                    className={styles.btnQuickView}
                    onClick={() => setActionOrderId(null)}
                  >
                    View Full Details →
                  </Link>
                </div>
              ) : (
                <div className={styles.quickDenyForm}>
                  <label>Reason for denial <span style={{ color: '#dc2626' }}>*</span></label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Payment screenshot unreadable..."
                    value={denyReason}
                    onChange={(e) => setDenyReason(e.target.value)}
                    disabled={actionLoading}
                  />
                  <div className={styles.quickDenyActions}>
                    <button 
                      className={styles.btnQuickConfirmDeny}
                      onClick={handleDeny}
                      disabled={actionLoading || !denyReason.trim()}
                    >
                      Confirm Deny
                    </button>
                    <button 
                      className="btn btnSecondary"
                      onClick={() => { setShowDenyForm(false); setDenyReason(''); }}
                      disabled={actionLoading}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
