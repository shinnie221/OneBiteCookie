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

  // Calculate active step in the 4-step flow
  const getActiveStepIndex = (status) => {
    if (status === 'rejected' || status === 'cancelled' || status === 'refunded') return -1;
    if (status === 'completed') return 3;
    if (status === 'out_delivery' || status === 'ready_pickup') return 2;
    if (status === 'preparing' || status === 'accepted') return 1;
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
          <h1 className={styles.pageTitle}>Order History & Tracking</h1>
          
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
                const isSpecialState = order.order_status === 'rejected' || order.order_status === 'cancelled' || order.order_status === 'refunded';
                const isActiveOrder = !isSpecialState && order.order_status !== 'completed';
                
                const whatsappCancelUrl = `https://wa.me/601110897061?text=${encodeURIComponent(`Hi OneBite, I would like to inquire about my order #${order.order_id}.`)}`;
                
                return (
                  <div key={order.order_id} className={styles.resultCard} style={{ marginBottom: '30px' }}>
                    <div className={styles.orderHeader}>
                      <div>
                        <h2 className={styles.orderId}>{order.order_id}</h2>
                        <p className={styles.orderDate}>
                          Placed on: {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={order.order_type === 'delivery' ? styles.typeTagDelivery : styles.typeTagPickup}>
                          {order.order_type === 'delivery' ? '🚚 Delivery' : '🛍️ Pickup'}
                        </span>
                        <OrderStatusBadge status={order.order_status} />
                      </div>
                    </div>
                    
                    {/* Order Timeline or Special State Box */}
                    <div className={styles.timeline}>
                      {isSpecialState ? (
                        <div className={styles.specialStatusCard}>
                          {order.order_status === 'rejected' && (
                            <div className={styles.rejectedBanner}>
                              <div className={styles.failedIcon}>✕</div>
                              <h3>Order Denied</h3>
                              {order.reject_reason ? (
                                <div className={styles.reasonBox}>
                                  <strong>Reason from OneBite:</strong>
                                  <p>{order.reject_reason}</p>
                                </div>
                              ) : (
                                <p>Our team could not process this order.</p>
                              )}
                              <p className={styles.contactHint}>
                                Have questions or want to fix payment? Contact us directly:
                              </p>
                              <a 
                                href={whatsappCancelUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={styles.btnWhatsApp}
                              >
                                💬 WhatsApp Support (011-10897061)
                              </a>
                            </div>
                          )}

                          {order.order_status === 'cancelled' && (
                            <div className={styles.cancelledBanner}>
                              <div className={styles.failedIcon}>🚫</div>
                              <h3>Order Cancelled</h3>
                              {order.staff_note && (
                                <div className={styles.reasonBox}>
                                  <strong>Note:</strong>
                                  <p>{order.staff_note}</p>
                                </div>
                              )}
                              <p className={styles.contactHint}>
                                If you need a refund or assistance regarding this cancellation:
                              </p>
                              <a 
                                href={whatsappCancelUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={styles.btnWhatsApp}
                              >
                                💬 Contact Support on WhatsApp
                              </a>
                            </div>
                          )}

                          {order.order_status === 'refunded' && (
                            <div className={styles.refundedBanner}>
                              <div className={styles.failedIcon}>💳</div>
                              <h3>Order Refunded</h3>
                              {order.staff_note && (
                                <div className={styles.reasonBox}>
                                  <strong>Refund Note:</strong>
                                  <p>{order.staff_note}</p>
                                </div>
                              )}
                              <p className={styles.contactHint}>
                                Payment has been refunded. If you have any inquiries, feel free to contact us.
                              </p>
                              <a 
                                href={whatsappCancelUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={styles.btnWhatsApp}
                              >
                                💬 WhatsApp Support
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={styles.steps}>
                          {ORDER_TIMELINE.map((step, index) => {
                            let status = 'upcoming';
                            if (index < activeStep) status = 'completed';
                            if (index === activeStep) status = 'active';
                            
                            // Handle delivery vs pickup label
                            let label = step.label;
                            if (index === 2) {
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
                                  {index === activeStep && (
                                    <span className={styles.currentStepBadge}>In Progress</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Active Order Cancellation Note */}
                    {isActiveOrder && (
                      <div className={styles.cancelHelpBox}>
                        <span>Need to cancel or request refund?</span>
                        <a 
                          href={whatsappCancelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.cancelLink}
                        >
                          💬 Contact us via WhatsApp
                        </a>
                      </div>
                    )}
                    
                    {/* Items & Total Summary */}
                    <div className={styles.itemsList}>
                      <h3>Items Ordered</h3>
                      <div className={styles.items}>
                        {order.items && order.items.map((item, idx) => (
                          <div key={item.id || idx} className={styles.itemRow}>
                            <span>{item.quantity}x {item.product_name}</span>
                            <span>RM{item.subtotal?.toFixed(2) || '0.00'}</span>
                          </div>
                        ))}
                      </div>
                      <div className={styles.summaryTotalRow}>
                        <span>Total Paid</span>
                        <span>RM{order.total.toFixed(2)}</span>
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
