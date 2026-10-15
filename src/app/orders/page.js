'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar/Navbar';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import {
  Clock,
  ChefHat,
  Package,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Store,
  Truck,
  X,
  AlertOctagon,
  CreditCard,
  MessageCircle
} from 'lucide-react';
import styles from './page.module.css';

const ORDER_TIMELINE = [
  { id: 'pending_verification', label: 'Payment Pending', icon: Clock },
  { id: 'preparing', label: 'Preparing', icon: ChefHat },
  { id: 'ready_pickup', label: 'Ready / Out for Delivery', icon: Package },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
];

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, authFetch, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});

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

        const fetchedOrders = data.orders || [];
        setOrders(fetchedOrders);

        // Active orders open by default; completed/cancelled collapsed (or open all if single order)
        const initial = {};
        fetchedOrders.forEach(o => {
          const isSpecial = ['rejected', 'cancelled', 'refunded'].includes(o.order_status);
          const isActive = !isSpecial && o.order_status !== 'completed';
          initial[o.order_id] = isActive || fetchedOrders.length === 1;
        });
        setExpandedOrders(initial);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, authLoading, router, authFetch]);

  const toggleOrder = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const allExpanded = orders.length > 0 && orders.every(o => expandedOrders[o.order_id]);

  const toggleAllOrders = () => {
    const nextState = !allExpanded;
    const updated = {};
    orders.forEach(o => {
      updated[o.order_id] = nextState;
    });
    setExpandedOrders(updated);
  };

  // Calculate active step in the 4-step flow
  const getActiveStepIndex = (status) => {
    if (status === 'rejected' || status === 'cancelled' || status === 'refunded') return -1;
    if (status === 'completed') return 4;
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
          <div className={styles.topBar}>
            <div>
              <h1 className={styles.pageTitle}>My Orders</h1>
              <p className={styles.pageSubtitle}>View your order history and track order progress</p>
            </div>
            {orders.length > 0 && (
              <button
                type="button"
                onClick={toggleAllOrders}
                className={styles.toggleAllBtn}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {allExpanded ? (
                  <>
                    <ChevronUp size={14} /> Collapse All
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Expand All Orders
                  </>
                )}
              </button>
            )}
          </div>

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
                const isOrderCompleted = order.order_status === 'completed';
                const isExpanded = !!expandedOrders[order.order_id];

                const whatsappCancelUrl = `https://wa.me/601110897061?text=${encodeURIComponent(`Hi OneBite, I would like to inquire about my order #${order.order_id}.`)}`;
                const totalItemCount = order.items ? order.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0;

                return (
                  <div key={order.order_id} className={styles.resultCard} style={{ marginBottom: '24px' }}>
                    <div
                      className={styles.orderHeader}
                      onClick={() => toggleOrder(order.order_id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                    >
                      <div className={styles.headerLeft}>
                        <div className={styles.idRow}>
                          <h2 className={styles.orderId}>{order.order_id}</h2>
                          <span className={order.order_type === 'delivery' ? styles.typeTagDelivery : styles.typeTagPickup} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {order.order_type === 'delivery' ? (
                              <>
                                <Truck size={13} /> Delivery
                              </>
                            ) : (
                              <>
                                <Store size={13} /> Pickup
                              </>
                            )}
                          </span>
                        </div>
                        <p className={styles.orderDate}>
                          Placed on: {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className={styles.headerRight}>
                        <div className={styles.headerAmount}>
                          <span className={styles.headerTotal}>RM{order.total.toFixed(2)}</span>
                          <span className={styles.headerItemCount}>({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})</span>
                        </div>
                        <OrderStatusBadge status={order.order_status} lang="en" />
                        <button
                          type="button"
                          className={styles.toggleBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOrder(order.order_id);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          {isExpanded ? (
                            <>
                              Hide Tracking <ChevronUp size={13} />
                            </>
                          ) : (
                            <>
                              Track Order <ChevronDown size={13} />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        {/* Order Timeline or Special State Box */}
                        <div className={styles.timeline}>
                          {isSpecialState ? (
                            <div className={styles.specialStatusCard}>
                              {order.order_status === 'rejected' && (
                                <div className={styles.rejectedBanner}>
                                  <div className={styles.failedIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <X size={20} />
                                  </div>
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
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    <MessageCircle size={15} /> WhatsApp Support (011-10897061)
                                  </a>
                                </div>
                              )}

                              {order.order_status === 'cancelled' && (
                                <div className={styles.cancelledBanner}>
                                  <div className={styles.failedIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <AlertOctagon size={20} />
                                  </div>
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
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    <MessageCircle size={15} /> Contact Support on WhatsApp
                                  </a>
                                </div>
                              )}

                              {order.order_status === 'refunded' && (
                                <div className={styles.refundedBanner}>
                                  <div className={styles.failedIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CreditCard size={20} />
                                  </div>
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
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    <MessageCircle size={15} /> WhatsApp Support
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={styles.steps}>
                              {ORDER_TIMELINE.map((step, index) => {
                                let status = 'upcoming';
                                if (isOrderCompleted || index < activeStep) {
                                  status = 'completed';
                                } else if (index === activeStep) {
                                  status = 'active';
                                }

                                // Handle delivery vs pickup label
                                let label = step.label;
                                if (index === 2) {
                                  label = order.order_type === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup';
                                }
                                const StepIcon = step.icon;
                                return (
                                  <div key={step.id} className={`${styles.step} ${styles[status]}`}>
                                    <div className={styles.stepIconWrapper}>
                                      <div className={styles.stepIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <StepIcon size={16} />
                                      </div>
                                      {index < ORDER_TIMELINE.length - 1 && <div className={styles.stepLine}></div>}
                                    </div>
                                    <div className={styles.stepContent}>
                                      <h4>{label}</h4>
                                      {index === activeStep && !isOrderCompleted && (
                                        <span className={styles.currentStepBadge}>In Progress</span>
                                      )}
                                      {index === 3 && isOrderCompleted && (
                                        <span className={styles.completedStepBadge}>Order Completed</span>
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
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            >
                              <MessageCircle size={14} /> Contact us via WhatsApp
                            </a>
                          </div>
                        )}

                        {/* Items & Total Summary */}
                        <div className={styles.itemsList}>
                          <h3>Items Ordered</h3>
                          <div className={styles.items}>
                            {order.items && order.items.map((item, idx) => (
                              <div key={item.id || idx} className={styles.itemRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <span>{item.quantity}x {item.product_name}{item.variant ? ` (${item.variant})` : ''}</span>
                                  {item.flavour_summary && (
                                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                                      {item.flavour_summary}
                                    </div>
                                  )}
                                </div>
                                <span>RM{item.subtotal?.toFixed(2) || '0.00'}</span>
                              </div>
                            ))}
                          </div>
                          <div className={styles.summaryTotalRow}>
                            <span>Total Paid</span>
                            <span>RM{order.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
