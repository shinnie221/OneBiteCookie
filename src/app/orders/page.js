'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

const ORDER_TIMELINE = [
  { id: 'pending_verification', label: 'Payment Pending', icon: '⏳' },
  { id: 'accepted', label: 'Order Accepted', icon: '📝' },
  { id: 'preparing', label: 'Preparing', icon: '🧑‍🍳' },
  { id: 'ready_pickup', label: 'Ready / Out for Delivery', icon: '📦' },
  { id: 'completed', label: 'Completed', icon: '✅' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, authFetch, loading: authLoading } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await authFetch('/api/orders');
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Failed to load orders');
        
        setOrders(data.orders || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, authLoading, router, authFetch]);

  // Calculate active step
  const getActiveStepIndex = (status) => {
    if (status === 'rejected' || status === 'cancelled') return -1;
    if (status === 'completed') return 4;
    if (status === 'out_delivery' || status === 'ready_pickup') return 3;
    if (status === 'preparing') return 2;
    if (status === 'accepted') return 1;
    return 0; // pending_verification
  };

  if (authLoading || (!isAuthenticated && loading)) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Navbar />
      <main className="pageContainer">
        <div className={styles.trackContainer}>
          <h1 className={styles.pageTitle}>Order History</h1>
          
          {error && <div className={styles.errorBox}>{error}</div>}
          
          {loading ? (
            <LoadingSpinner text="Loading orders..." />
          ) : orders.length === 0 ? (
            <div className={styles.emptyCart}>
              <h2>You haven't placed any orders yet.</h2>
            </div>
          ) : (
            <div className={styles.ordersList}>
              {orders.map(order => {
                const activeStep = getActiveStepIndex(order.order_status);
                const isFailed = order.order_status === 'rejected' || order.order_status === 'cancelled';
                
                return (
                  <div key={order.order_id} className={styles.resultCard} style={{ marginBottom: '30px' }}>
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
                        {order.items && order.items.map(item => (
                          <div key={item.id} className={styles.itemRow}>
                            <span>{item.quantity}x {item.product_name}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: '15px', fontWeight: 'bold' }}>
                        Total: RM{order.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
