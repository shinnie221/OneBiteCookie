'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

const STATUS_OPTIONS = [
  { value: 'pending_verification', label: 'Pending Verification' },
  { value: 'accepted', label: 'Order Accepted' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready_pickup', label: 'Ready for Pickup' },
  { value: 'out_delivery', label: 'Out for Delivery' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const { authFetch } = useAuth();
  const toast = useToast();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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
        toast.success('Order updated successfully');
        setSelectedOrder(data.order);
        
        // Update order in list
        setOrders(prev => prev.map(o => o.order_id === orderId ? data.order : o));
      } else {
        toast.error(data.error || 'Failed to update order');
      }
    } catch (error) {
      toast.error('Error updating order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyPayment = (accept) => {
    if (accept) {
      updateOrderStatus(selectedOrder.order_id, {
        payment_status: 'verified',
        order_status: 'accepted'
      });
    } else {
      if (confirm('Are you sure you want to reject this payment and order?')) {
        updateOrderStatus(selectedOrder.order_id, {
          payment_status: 'rejected',
          order_status: 'rejected'
        });
      }
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Order Management</h1>
        <div className={styles.filters}>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Orders</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="accepted">Accepted / Active</option>
            <option value="completed">Completed</option>
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
                    <td colSpan="7" className="textCenter">No orders found</td>
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
                      <td>{order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</td>
                      <td className={styles.totalCell}>RM{order.total.toFixed(2)}</td>
                      <td><OrderStatusBadge status={order.order_status} /></td>
                      <td>
                        <button 
                          className="btn btnSecondary" 
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          onClick={() => openOrderModal(order)}
                        >
                          View
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

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`Order ${selectedOrder?.order_id}`}
      >
        {selectedOrder && (
          <div className={styles.modalContent}>
            {/* Status Section */}
            <div className={styles.statusSection}>
              <div className={styles.sectionHeader}>Order Status</div>
              <div className={styles.statusControls}>
                <div className={styles.currentStatus}>
                  Current: <OrderStatusBadge status={selectedOrder.order_status} />
                </div>
                <div className={styles.updateStatus}>
                  <select 
                    value={selectedOrder.order_status}
                    onChange={(e) => updateOrderStatus(selectedOrder.order_id, { order_status: e.target.value })}
                    disabled={actionLoading}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.grid2}>
              {/* Customer Info */}
              <div className={styles.infoBlock}>
                <div className={styles.sectionHeader}>Customer Details</div>
                <p><strong>Name:</strong> {selectedOrder.customer_name}</p>
                <p><strong>Phone:</strong> {selectedOrder.phone}</p>
                {selectedOrder.email && <p><strong>Email:</strong> {selectedOrder.email}</p>}
                <p><strong>Type:</strong> {selectedOrder.order_type === 'delivery' ? 'Delivery' : 'Store Pickup'}</p>
                {selectedOrder.order_type === 'delivery' && (
                  <p><strong>Address:</strong> {selectedOrder.address}</p>
                )}
              </div>

              {/* Payment Info */}
              <div className={styles.infoBlock}>
                <div className={styles.sectionHeader}>Payment Details</div>
                <p><strong>Subtotal:</strong> RM{selectedOrder.subtotal.toFixed(2)}</p>
                {selectedOrder.discount > 0 && (
                  <p className={styles.textSuccess}><strong>Discount ({selectedOrder.voucher_code}):</strong> -RM{selectedOrder.discount.toFixed(2)}</p>
                )}
                <p className={styles.grandTotal}><strong>Total:</strong> RM{selectedOrder.total.toFixed(2)}</p>
                
                {selectedOrder.order_status === 'pending_verification' && (
                  <div className={styles.paymentActions}>
                    <button 
                      className="btn btnPrimary" 
                      style={{ padding: '8px' }}
                      onClick={() => handleVerifyPayment(true)}
                      disabled={actionLoading}
                    >
                      ✓ Accept
                    </button>
                    <button 
                      className="btn btnDanger" 
                      style={{ padding: '8px' }}
                      onClick={() => handleVerifyPayment(false)}
                      disabled={actionLoading}
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Proof */}
            <div className={styles.infoBlock}>
              <div className={styles.sectionHeader}>Payment Screenshot</div>
              {selectedOrder.payment_screenshot ? (
                <div className={styles.screenshotBox}>
                  <img src={selectedOrder.payment_screenshot} alt="Payment Proof" className={styles.screenshot} />
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
                  {selectedOrder.items && selectedOrder.items.map(item => (
                    <tr key={item.id}>
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
    </div>
  );
}
