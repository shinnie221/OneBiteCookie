'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

const ORDER_TIMELINE = [
  { id: 'pending_verification', label: 'Payment Pending', icon: '⏳' },
  { id: 'accepted', label: 'Order Accepted', icon: '📝' },
  { id: 'preparing', label: 'Preparing', icon: '🧑‍🍳' },
  { id: 'ready_pickup', label: 'Ready for Pickup / Out for Delivery', icon: '📦' },
  { id: 'completed', label: 'Completed', icon: '✅' },
];

function TrackContent() {
  const searchParams = useSearchParams();
  const initId = searchParams.get('id') || '';
  
  const [orderId, setOrderId] = useState(initId);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const fetchOrder = async (id) => {
    if (!id.trim()) return;
    setLoading(true);
    setError('');
    setOrder(null);
    
    try {
      const res = await fetch(`/api/orders/${id.trim().toUpperCase()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Order not found');
      
      setOrder(data.order);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (initId) fetchOrder(initId);
  }, [initId]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrder(orderId);
  };
  
  // Calculate active step
  const getActiveStepIndex = (status) => {
    if (status === 'rejected' || status === 'cancelled') return -1;
    if (status === 'completed') return 4;
    if (status === 'out_delivery' || status === 'ready_pickup') return 3;
    if (status === 'preparing') return 2;
    if (status === 'accepted') return 1;
    return 0; // pending_verification
  };
  
  const activeStep = order ? getActiveStepIndex(order.order_status) : -1;
  const isFailed = order && (order.order_status === 'rejected' || order.order_status === 'cancelled');

  return (
    <div className={styles.trackContainer}>
      <h1 className={styles.pageTitle}>Track Your Order</h1>
      
      <form className={styles.searchForm} onSubmit={handleSearch}>
        <div className={styles.searchInput}>
          <span className={styles.searchIcon}>🔍</span>
          <input 
            type="text" 
            placeholder="Enter Order ID (e.g. OB-2026...)" 
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
          />
          <button type="submit" className="btn btnPrimary" disabled={loading}>
            {loading ? 'Searching...' : 'Track'}
          </button>
        </div>
      </form>
      
      {error && <div className={styles.errorBox}>{error}</div>}
      
      {order && (
        <div className={styles.resultCard}>
          <div className={styles.orderHeader}>
            <div>
              <h2 className={styles.orderId}>{order.order_id}</h2>
              <p className={styles.orderDate}>{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <OrderStatusBadge status={order.order_status} />
          </div>
          
          <div className={styles.timeline}>
            {isFailed ? (
              <div className={styles.failedState}>
                <div className={styles.failedIcon}>❌</div>
                <h3>Order {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}</h3>
                <p>Please contact our support for more information.</p>
              </div>
            ) : (
              <div className={styles.steps}>
                {ORDER_TIMELINE.map((step, index) => {
                  let status = 'upcoming';
                  if (index < activeStep) status = 'completed';
                  if (index === activeStep) status = 'active';
                  
                  // Handle delivery vs pickup
                  let label = step.label;
                  if (index === 3) {
                    label = order.order_type === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup';
                  }
                  
                  return (
                    <div key={step.id} className={`${styles.step} ${styles[status]}`}>
                      <div className={styles.stepIconWrapper}>
                        <div className={styles.stepIcon}>{step.icon}</div>
                        {index < ORDER_TIMELINE.length - 1 && <div className={styles.stepLine}></div>}
                      </div>
                      <div className={styles.stepContent}>
                        <h4>{label}</h4>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className={styles.itemsList}>
            <h3>Items Ordered</h3>
            <div className={styles.items}>
              {order.items.map(item => (
                <div key={item.id} className={styles.itemRow}>
                  <span>{item.quantity}x {item.product_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <>
      <Navbar />
      <main className="pageContainer">
        <Suspense fallback={<LoadingSpinner />}>
          <TrackContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
