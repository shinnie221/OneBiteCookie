'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

const statusLabels = {
  pending_verification: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready_pickup: 'Ready',
  out_delivery: 'Out for Delivery',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const statusColors = {
  pending_verification: { bg: '#fef3c7', color: '#92400e' },
  accepted: { bg: '#dbeafe', color: '#1e40af' },
  preparing: { bg: '#e0e7ff', color: '#3730a3' },
  ready_pickup: { bg: '#d1fae5', color: '#065f46' },
  out_delivery: { bg: '#cffafe', color: '#155e75' },
  completed: { bg: '#d1fae5', color: '#047857' },
  rejected: { bg: '#fee2e2', color: '#b91c1c' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280' },
  refunded: { bg: '#ede9fe', color: '#6d28d9' },
};

export default function CustomersPage() {
  const { authFetch } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await authFetch('/api/customers');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to load customers');
      
      setCustomers(data.customers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1>Registered Customers</h1>
          <p className={styles.subtitle}>{customers.length} customer{customers.length !== 1 ? 's' : ''} registered</p>
        </div>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className={styles.customerList}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No customers found.</p>
          </div>
        ) : (
          filtered.map(customer => (
            <div key={customer.id} className={`card ${styles.customerCard}`}>
              <button
                className={styles.customerRow}
                onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
                type="button"
              >
                <div className={styles.customerAvatar}>
                  {(customer.name || '?')[0].toUpperCase()}
                </div>
                <div className={styles.customerInfo}>
                  <div className={styles.customerName}>{customer.name || 'Unknown'}</div>
                  <div className={styles.customerEmail}>{customer.email}</div>
                </div>
                <div className={styles.customerStats}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{customer.orderCount}</span>
                    <span className={styles.statLabel}>Orders</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>RM{customer.totalSpent ? customer.totalSpent.toFixed(2) : '0.00'}</span>
                    <span className={styles.statLabel}>Spent</span>
                  </div>
                </div>
                <div className={`${styles.expandIcon} ${expandedId === customer.id ? styles.expanded : ''}`}>
                  ▾
                </div>
              </button>

              {expandedId === customer.id && (
                <div className={styles.customerDetail}>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>📧 Email</span>
                      <span className={styles.detailValue}>{customer.email || '—'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>📱 Phone</span>
                      <span className={styles.detailValue}>{customer.phone || 'Not provided yet'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>📅 Registered</span>
                      <span className={styles.detailValue}>
                        {customer.createdAt || customer.created_at
                          ? new Date(customer.createdAt || customer.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>🔑 Login</span>
                      <span className={styles.detailValue}>{customer.authProvider === 'google' ? 'Google' : 'Email'}</span>
                    </div>
                  </div>

                  <div className={styles.orderHistory}>
                    <h3>Order History</h3>
                    {(!customer.orders || customer.orders.length === 0) ? (
                      <p className={styles.noOrders}>No orders yet.</p>
                    ) : (
                      <div className={styles.orderList}>
                        {customer.orders.map(order => (
                          <div key={order.id} className={styles.orderItem}>
                            <div className={styles.orderHeader}>
                              <span className={styles.orderId}>{order.order_id}</span>
                              <span
                                className={styles.orderStatus}
                                style={{
                                  background: (statusColors[order.order_status] || statusColors.pending_verification).bg,
                                  color: (statusColors[order.order_status] || statusColors.pending_verification).color,
                                }}
                              >
                                {statusLabels[order.order_status] || order.order_status}
                              </span>
                            </div>
                            <div className={styles.orderMeta}>
                              <span>{new Date(order.created_at).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              <span>•</span>
                              <span>{order.order_type === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}</span>
                              <span>•</span>
                              <span style={{ fontWeight: 600 }}>RM{(order.total || 0).toFixed(2)}</span>
                            </div>
                            {order.items && (
                              <div className={styles.orderItems}>
                                {order.items.map((item, idx) => (
                                  <span key={idx} className={styles.orderItemTag}>
                                    {item.quantity}× {item.product_name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
