'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar/Navbar';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const TIMELINE_STEPS = [
  { id: 'pending_verification', label: 'Payment Pending', icon: '⏳' },
  { id: 'preparing', label: 'Preparing', icon: '🧑‍🍳' },
  { id: 'ready_pickup', label: 'Ready / Out for Delivery', icon: '📦' },
  { id: 'completed', label: 'Completed', icon: '✅' },
];

function getActiveStepIndex(status) {
  switch (status) {
    case 'pending_verification':
      return 0;
    case 'preparing':
    case 'accepted':
      return 1;
    case 'ready_pickup':
    case 'out_delivery':
      return 2;
    case 'completed':
      return 3;
    default:
      return 0;
  }
}

function TrackContent() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get('order_id') || searchParams.get('orderId') || '';

  const { isAuthenticated } = useAuth();
  const [searchType, setSearchType] = useState('orderId'); // 'orderId' | 'phone'
  const [queryValue, setQueryValue] = useState(initialOrderId);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e) => {
    if (e) e.preventDefault();
    if (!queryValue.trim()) {
      setError('Please enter your Order ID or Phone Number.');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const paramName = searchType === 'orderId' ? 'orderId' : 'phone';
      const res = await fetch(`/api/orders/track?${paramName}=${encodeURIComponent(queryValue.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to track order');
      }

      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderId) {
      handleTrack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  return (
    <div className="pageContainer">
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Track Your Order</h1>
        <p className={styles.subtitle}>Check real-time preparation & fulfillment progress</p>
      </div>

      <div className={styles.searchCard}>
        <div className={styles.searchTabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${searchType === 'orderId' ? styles.activeTab : ''}`}
            onClick={() => {
              setSearchType('orderId');
              setError('');
            }}
          >
            By Order ID
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${searchType === 'phone' ? styles.activeTab : ''}`}
            onClick={() => {
              setSearchType('phone');
              setError('');
            }}
          >
            By Phone Number
          </button>
        </div>

        <form onSubmit={handleTrack} className={styles.searchForm}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={searchType === 'orderId' ? 'e.g. OB-20261011-0428' : 'e.g. 012-345 6789'}
            value={queryValue}
            onChange={(e) => setQueryValue(e.target.value)}
          />
          <button type="submit" className={styles.searchSubmitBtn} disabled={loading}>
            {loading ? 'Searching...' : 'Track Order'}
          </button>
        </form>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading && <LoadingSpinner text="Searching order details..." />}

      <div className={styles.resultsSection}>
        {searched && !loading && orders.length === 0 && !error && (
          <div className={styles.errorBox}>No orders found. Please check your input.</div>
        )}

        {orders.map((order) => {
          const activeStep = getActiveStepIndex(order.order_status);
          const isSpecial = ['rejected', 'cancelled', 'refunded'].includes(order.order_status);
          const whatsappUrl = `https://wa.me/601110897061?text=${encodeURIComponent(
            `Hi One Bite, I would like to inquire about my order #${order.order_id}.`
          )}`;

          return (
            <div key={order.order_id} className={styles.orderCard}>
              <div className={styles.orderCardHeader}>
                <div>
                  <div className={styles.orderId}>{order.order_id}</div>
                  <div className={styles.orderDate}>
                    Placed on: {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
                <OrderStatusBadge status={order.order_status} lang="en" />
              </div>

              {!isSpecial && (
                <div className={styles.timeline}>
                  {TIMELINE_STEPS.map((step, idx) => {
                    const isCompleted = idx < activeStep;
                    const isActive = idx === activeStep;
                    return (
                      <div
                        key={step.id}
                        className={`${styles.timelineStep} ${isCompleted ? styles.completed : ''} ${
                          isActive ? styles.active : ''
                        }`}
                      >
                        <div className={styles.stepIconWrap}>{step.icon}</div>
                        <div className={styles.stepLabel}>{step.label}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={styles.orderDetails}>
                <div className={styles.detailRow}>
                  <span>Fulfillment Type</span>
                  <strong>{order.order_type === 'delivery' ? '🚚 Delivery' : '🛍️ Store Pickup'}</strong>
                </div>

                {order.order_type === 'pickup' && order.pickup_time && (
                  <div className={styles.detailRow}>
                    <span>Pickup Time</span>
                    <strong>{order.pickup_time}</strong>
                  </div>
                )}

                {order.order_type === 'delivery' && order.delivery_address && (
                  <div className={styles.detailRow}>
                    <span>Delivery Address</span>
                    <span>
                      {order.delivery_address}, {order.delivery_city || ''} {order.delivery_postcode || ''}
                    </span>
                  </div>
                )}

                <div className={styles.itemsList}>
                  <div className={styles.itemsTitle}>Order Items</div>
                  {order.items.map((item, i) => (
                    <div key={i} className={styles.itemRow}>
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>RM{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.detailRow} style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  <span>Total Amount</span>
                  <span style={{ color: 'var(--color-primary)' }}>RM{order.total.toFixed(2)}</span>
                </div>

                <div className={styles.whatsappBox}>
                  <span className={styles.whatsappText}>Need help or have questions regarding this order?</span>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.whatsappBtn}
                  >
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.loginPrompt}>
        {isAuthenticated ? (
          <p>
            Looking for all your past purchases?{' '}
            <Link href="/orders">View full order history in My Orders</Link>
          </p>
        ) : (
          <p>
            Have an account? <Link href="/login">Sign in</Link> to view all your order history.
          </p>
        )}
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<LoadingSpinner text="Loading..." />}>
          <TrackContent />
        </Suspense>
      </main>
    </>
  );
}
