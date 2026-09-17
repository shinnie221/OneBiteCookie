'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

const statusLabels = {
  pending_verification: '待核验',
  accepted: '已接单',
  preparing: '制作中',
  ready_pickup: '待自取',
  out_delivery: '配送中',
  completed: '已完成',
  rejected: '已拒绝',
  cancelled: '已取消',
  refunded: '已退款',
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
      
      if (!res.ok) throw new Error(data.error || '无法加载顾客列表');
      
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

  if (loading) return <LoadingSpinner text="正在加载顾客信息..." />;

  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1>官网注册会员名录</h1>
          <p className={styles.subtitle}>已注册 {customers.length} 位顾客会员</p>
        </div>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="搜索姓名、邮箱或手机号码..."
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
            <p>未找到符合条件的顾客。</p>
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
                  <div className={styles.customerName}>{customer.name || '未知用户'}</div>
                  <div className={styles.customerEmail}>{customer.email}</div>
                </div>
                <div className={styles.customerStats}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{customer.orderCount}</span>
                    <span className={styles.statLabel}>历史订单</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>RM{customer.totalSpent ? customer.totalSpent.toFixed(2) : '0.00'}</span>
                    <span className={styles.statLabel}>累计消费</span>
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
                      <span className={styles.detailLabel}>📧 电子邮箱</span>
                      <span className={styles.detailValue}>{customer.email || '—'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>📱 联系电话</span>
                      <span className={styles.detailValue}>{customer.phone || '暂未填写'}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>📅 注册时间</span>
                      <span className={styles.detailValue}>
                        {customer.createdAt || customer.created_at
                          ? new Date(customer.createdAt || customer.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>🔑 登录方式</span>
                      <span className={styles.detailValue}>{customer.authProvider === 'google' ? 'Google 登录' : '邮箱密码'}</span>
                    </div>
                  </div>

                  <div className={styles.orderHistory}>
                    <h3>历史订单记录</h3>
                    {(!customer.orders || customer.orders.length === 0) ? (
                      <p className={styles.noOrders}>暂无下单记录。</p>
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
                              <span>{new Date(order.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                              <span>•</span>
                              <span>{order.order_type === 'delivery' ? '🚚 送货上门' : '🏪 到店自取'}</span>
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
