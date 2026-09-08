'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function OrdersPage() {
  const { authFetch } = useAuth();
  const toast = useToast();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [fullScreenshotUrl, setFullScreenshotUrl] = useState(null);

  // States for prompt forms
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState('');
  
  const [showSpecialActionForm, setShowSpecialActionForm] = useState(null); // 'cancel' | 'refund' | null
  const [specialActionNote, setSpecialActionNote] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/orders' : `/api/orders?status=${filter}`;
      const res = await authFetch(url);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders);
      }
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const openOrderModal = (order) => {
    setSelectedOrder(order);
    setShowDenyForm(false);
    setDenyReason('');
    setShowSpecialActionForm(null);
    setSpecialActionNote('');
    setIsModalOpen(true);
  };

  const updateOrderStatus = async (orderId, updates) => {
    setActionLoading(true);
    try {
      const res = await authFetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Order status updated successfully');
        setSelectedOrder(data.order);
        
        // Update order in list
        setOrders(prev => prev.map(o => o.order_id === orderId ? data.order : o));
        
        // Reset local form states
        setShowDenyForm(false);
        setDenyReason('');
        setShowSpecialActionForm(null);
        setSpecialActionNote('');
      } else {
        toast.error(data.error || 'Failed to update order');
      }
    } catch (error) {
      toast.error('Error updating order');
    } finally {
      setActionLoading(false);
    }
  };

  // Flow Step 1: Accept -> Automatically start preparing
  const handleAcceptOrder = () => {
    updateOrderStatus(selectedOrder.order_id, {
      payment_status: 'verified',
      order_status: 'preparing'
    });
  };

  // Flow Step 1 alternative: Deny / Reject with comment
  const handleConfirmDeny = () => {
    if (!denyReason.trim()) {
      toast.error('Please enter a reason for denying this order');
      return;
    }
    updateOrderStatus(selectedOrder.order_id, {
      payment_status: 'rejected',
      order_status: 'rejected',
      reject_reason: denyReason.trim()
    });
  };

  // Flow Step 2: Done preparing -> delivering / ready for pickup
  const handleDonePreparing = () => {
    const nextStatus = selectedOrder.order_type === 'delivery' ? 'out_delivery' : 'ready_pickup';
    updateOrderStatus(selectedOrder.order_id, {
      order_status: nextStatus
    });
  };

  // Flow Step 3: Delivered or Picked Up -> Completed
  const handleMarkCompleted = () => {
    updateOrderStatus(selectedOrder.order_id, {
      order_status: 'completed'
    });
  };

  // Flow Step 4: Cancel or Refund (Customer requested manually)
  const handleConfirmSpecialAction = () => {
    if (showSpecialActionForm === 'cancel') {
      updateOrderStatus(selectedOrder.order_id, {
        order_status: 'cancelled',
        staff_note: specialActionNote.trim() || 'Cancelled per customer request'
      });
    } else if (showSpecialActionForm === 'refund') {
      updateOrderStatus(selectedOrder.order_id, {
        order_status: 'refunded',
        payment_status: 'refunded',
        staff_note: specialActionNote.trim() || 'Refunded per customer request'
      });
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Order Management</h1>
          <p className={styles.subtitle}>Process orders seamlessly through each stage of preparation and fulfillment.</p>
        </div>
        <div className={styles.filters}>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Orders</option>
            <option value="pending_verification">⏳ Pending Verification</option>
            <option value="preparing">🧑‍🍳 Preparing</option>
            <option value="ready_pickup">🛍️ Ready for Pickup</option>
            <option value="out_delivery">🚚 Out for Delivery</option>
            <option value="completed">✅ Completed</option>
            <option value="rejected">❌ Denied / Rejected</option>
            <option value="cancelled">🚫 Cancelled</option>
            <option value="refunded">💳 Refunded</option>
          </select>
          <button onClick={fetchOrders} className="btn btnSecondary">↻ Refresh</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="textCenter" style={{ padding: '30px', color: 'var(--color-text-light)' }}>
                      No orders found matching this filter
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className={order.order_status === 'pending_verification' ? styles.highlightRow : ''}>
                      <td className={styles.orderIdCell}>{order.order_id}</td>
                      <td>{new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <div className={styles.customerName}>{order.customer_name}</div>
                        <div className={styles.customerPhone}>{order.phone}</div>
                      </td>
                      <td>
                        <span className={order.order_type === 'delivery' ? styles.deliveryBadge : styles.pickupBadge}>
                          {order.order_type === 'delivery' ? '🚚 Delivery' : '🛍️ Pickup'}
                        </span>
                      </td>
                      <td className={styles.totalCell}>RM{order.total.toFixed(2)}</td>
                      <td><OrderStatusBadge status={order.order_status} /></td>
                      <td>
                        <button 
                          className="btn btnSecondary" 
                          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                          onClick={() => openOrderModal(order)}
                        >
                          View & Process
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail & Processing Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`Order Details - #${selectedOrder?.order_id}`}
      >
        {selectedOrder && (
          <div className={styles.modalContent}>
            
            {/* Step-by-Step Order Flow Control Card */}
            <div className={styles.flowSection}>
              <div className={styles.flowHeader}>
                <div>
                  <span className={styles.flowHeaderSubtitle}>Current Order Status</span>
                  <div className={styles.currentStatusRow}>
                    <OrderStatusBadge status={selectedOrder.order_status} />
                    <span className={styles.orderTypeTag}>
                      {selectedOrder.order_type === 'delivery' ? '🚚 Home Delivery' : '🛍️ Store Pickup'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION STAGE 1: Pending Verification */}
              {selectedOrder.order_status === 'pending_verification' && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>Action Required:</strong> Review customer payment proof below. Accept to automatically start preparing, or deny with a message.
                  </div>
                  
                  {!showDenyForm ? (
                    <div className={styles.actionButtonGroup}>
                      <button 
                        className={styles.btnAccept}
                        onClick={handleAcceptOrder}
                        disabled={actionLoading}
                      >
                        ✓ Accept & Start Preparing
                      </button>
                      <button 
                        className={styles.btnDeny}
                        onClick={() => setShowDenyForm(true)}
                        disabled={actionLoading}
                      >
                        ✕ Deny Order
                      </button>
                    </div>
                  ) : (
                    <div className={styles.denyBox}>
                      <label className={styles.denyLabel}>
                        Reason for Denial <span className={styles.requiredStar}>*</span> (Customer will see this):
                      </label>
                      <textarea
                        className={styles.denyTextarea}
                        rows="3"
                        placeholder="e.g. Payment receipt unreadable, please re-upload or contact us via WhatsApp..."
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                        disabled={actionLoading}
                      />
                      <div className={styles.denyActions}>
                        <button 
                          className={styles.btnConfirmDeny}
                          onClick={handleConfirmDeny}
                          disabled={actionLoading || !denyReason.trim()}
                        >
                          Confirm & Send Denial
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
              )}

              {/* ACTION STAGE 2: Preparing */}
              {(selectedOrder.order_status === 'preparing' || selectedOrder.order_status === 'accepted') && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>In Kitchen:</strong> Cookies are being freshly baked and prepared. Once finished, click below to update the status for the customer.
                  </div>
                  <div className={styles.actionButtonGroup}>
                    <button 
                      className={styles.btnPreparingDone}
                      onClick={handleDonePreparing}
                      disabled={actionLoading}
                    >
                      {selectedOrder.order_type === 'delivery' 
                        ? '🚚 Done Preparing → Mark Out for Delivery' 
                        : '🛍️ Done Preparing → Mark Ready for Pickup'}
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION STAGE 3: Out for Delivery or Ready for Pickup */}
              {selectedOrder.order_status === 'out_delivery' && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>In Transit:</strong> Cookies are out for delivery to customer address. Once safely handed over, mark as completed.
                  </div>
                  <div className={styles.actionButtonGroup}>
                    <button 
                      className={styles.btnComplete}
                      onClick={handleMarkCompleted}
                      disabled={actionLoading}
                    >
                      ✅ Delivered → Mark as Completed
                    </button>
                  </div>
                </div>
              )}

              {selectedOrder.order_status === 'ready_pickup' && (
                <div className={styles.flowActionBox}>
                  <div className={styles.flowStepNotice}>
                    <strong>Ready at Counter:</strong> Order is packaged and waiting for customer pickup. Once collected, mark as completed.
                  </div>
                  <div className={styles.actionButtonGroup}>
                    <button 
                      className={styles.btnComplete}
                      onClick={handleMarkCompleted}
                      disabled={actionLoading}
                    >
                      ✅ Picked Up → Mark as Completed
                    </button>
                  </div>
                </div>
              )}

              {/* COMPLETED BANNER */}
              {selectedOrder.order_status === 'completed' && (
                <div className={styles.completedNotice}>
                  🎉 This order is completed and fulfilled.
                </div>
              )}

              {/* REJECTED BANNER & COMMENT */}
              {selectedOrder.order_status === 'rejected' && (
                <div className={styles.rejectedNotice}>
                  <div className={styles.rejectedTitle}>✕ Order Denied</div>
                  {selectedOrder.reject_reason ? (
                    <div className={styles.reasonText}>
                      <strong>Customer was notified:</strong> "{selectedOrder.reject_reason}"
                    </div>
                  ) : (
                    <p className={styles.noData}>No specific denial reason recorded.</p>
                  )}
                </div>
              )}

              {/* CANCELLED BANNER & NOTE */}
              {selectedOrder.order_status === 'cancelled' && (
                <div className={styles.cancelledNotice}>
                  <div className={styles.cancelledTitle}>🚫 Order Cancelled</div>
                  {selectedOrder.staff_note && (
                    <div className={styles.reasonText}>
                      <strong>Staff Note:</strong> "{selectedOrder.staff_note}"
                    </div>
                  )}
                </div>
              )}

              {/* REFUNDED BANNER & NOTE */}
              {selectedOrder.order_status === 'refunded' && (
                <div className={styles.refundedNotice}>
                  <div className={styles.refundedTitle}>💳 Order Refunded</div>
                  {selectedOrder.staff_note && (
                    <div className={styles.reasonText}>
                      <strong>Staff Note:</strong> "{selectedOrder.staff_note}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer Cancellation / Refund Actions */}
            {selectedOrder.order_status !== 'cancelled' && selectedOrder.order_status !== 'rejected' && selectedOrder.order_status !== 'refunded' && (
              <div className={styles.specialActionsSection}>
                <div className={styles.specialActionsHeader}>
                  <span>Manual Customer Requests (Cancellation & Refund)</span>
                  <small>If customer contacted via WhatsApp/Phone to cancel</small>
                </div>
                
                {!showSpecialActionForm ? (
                  <div className={styles.specialButtonsRow}>
                    <button 
                      className={styles.btnSecondaryCancel}
                      onClick={() => { setShowSpecialActionForm('cancel'); setSpecialActionNote(''); }}
                      disabled={actionLoading}
                    >
                      Mark as Cancelled
                    </button>
                    <button 
                      className={styles.btnSecondaryRefund}
                      onClick={() => { setShowSpecialActionForm('refund'); setSpecialActionNote(''); }}
                      disabled={actionLoading}
                    >
                      Mark as Refunded
                    </button>
                  </div>
                ) : (
                  <div className={styles.specialActionForm}>
                    <p className={styles.specialActionTitle}>
                      {showSpecialActionForm === 'cancel' ? 'Confirm Order Cancellation' : 'Confirm Order Refund'}
                    </p>
                    <input 
                      type="text"
                      className={styles.specialActionInput}
                      placeholder={showSpecialActionForm === 'cancel' ? "Reason / Customer cancellation note..." : "Refund details / reference number..."}
                      value={specialActionNote}
                      onChange={(e) => setSpecialActionNote(e.target.value)}
                      disabled={actionLoading}
                    />
                    <div className={styles.denyActions}>
                      <button 
                        className={showSpecialActionForm === 'cancel' ? styles.btnConfirmDeny : styles.btnConfirmRefund}
                        onClick={handleConfirmSpecialAction}
                        disabled={actionLoading}
                      >
                        {showSpecialActionForm === 'cancel' ? 'Confirm Cancel Order' : 'Confirm Process Refund'}
                      </button>
                      <button 
                        className="btn btnSecondary"
                        onClick={() => setShowSpecialActionForm(null)}
                        disabled={actionLoading}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={styles.grid2}>
              {/* Customer Info */}
              <div className={styles.infoBlock}>
                <div className={styles.sectionHeader}>Customer Details</div>
                <p><strong>Name:</strong> {selectedOrder.customer_name}</p>
                <p><strong>Phone:</strong> {selectedOrder.phone}</p>
                {selectedOrder.email && <p><strong>Email:</strong> {selectedOrder.email}</p>}
                <p><strong>Fulfillment:</strong> {selectedOrder.order_type === 'delivery' ? 'Delivery' : 'Store Pickup'}</p>
                {selectedOrder.order_type === 'delivery' && (
                  <p><strong>Delivery Address:</strong> {selectedOrder.address}</p>
                )}
              </div>

              {/* Payment Info */}
              <div className={styles.infoBlock}>
                <div className={styles.sectionHeader}>Payment Summary</div>
                <p><strong>Subtotal:</strong> RM{selectedOrder.subtotal?.toFixed(2) || '0.00'}</p>
                {selectedOrder.discount > 0 && (
                  <p className={styles.textSuccess}>
                    <strong>Discount ({selectedOrder.voucher_code || 'Voucher'}):</strong> -RM{selectedOrder.discount.toFixed(2)}
                  </p>
                )}
                <p className={styles.grandTotal}><strong>Total:</strong> RM{selectedOrder.total.toFixed(2)}</p>
                <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                  <strong>Payment Status:</strong> {selectedOrder.payment_status || 'pending'}
                </p>
              </div>
            </div>

            {/* Payment Proof */}
            <div className={styles.infoBlock}>
              <div className={styles.sectionHeader}>Payment Receipt Proof</div>
              {selectedOrder.payment_screenshot ? (
                <div className={styles.screenshotBox}>
                  <img 
                    src={selectedOrder.payment_screenshot} 
                    alt="Payment Proof" 
                    className={styles.screenshot} 
                    style={{ cursor: 'zoom-in' }}
                    onClick={() => setFullScreenshotUrl(selectedOrder.payment_screenshot)}
                    title="Click to zoom in"
                  />
                  <div className={styles.screenshotHint}>Click image to view full size</div>
                </div>
              ) : (
                <p className={styles.noData}>No payment screenshot provided.</p>
              )}
            </div>

            {/* Order Items */}
            <div className={styles.infoBlock}>
              <div className={styles.sectionHeader}>Items Ordered</div>
              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="textRight">Qty</th>
                    <th className="textRight">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>{item.product_name}</td>
                      <td className="textRight">{item.quantity}</td>
                      <td className="textRight">RM{item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </Modal>

      {/* Full Size Screenshot Lightbox */}
      {fullScreenshotUrl && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, cursor: 'zoom-out' }}
          onClick={() => setFullScreenshotUrl(null)}
        >
          <img src={fullScreenshotUrl} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px' }} alt="Full Screenshot" />
        </div>
      )}
    </div>
  );
}
