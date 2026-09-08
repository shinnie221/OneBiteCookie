'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useToast } from '@/context/ToastContext';
import styles from './ManualOrderModal.module.css';

export default function ManualOrderModal({ isOpen, onClose, onOrderCreated }) {
  const toast = useToast();

  // Products from catalog
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [orderType, setOrderType] = useState('pickup');
  const [address, setAddress] = useState('');

  // Cart items: [{ product_id, product_name, price, quantity, max_stock }]
  const [orderItems, setOrderItems] = useState([]);

  // Payment & Status
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('verified');
  const [orderStatus, setOrderStatus] = useState('preparing');
  const [manualDiscount, setManualDiscount] = useState('');
  const [staffNote, setStaffNote] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Load products when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      toast.error('Failed to load product menu');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Add product to cart
  const handleAddItem = (prod) => {
    if (prod.stock <= 0) {
      toast.error(`"${prod.name}" is out of stock`);
      return;
    }

    setOrderItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === prod.id);
      if (existingIndex > -1) {
        const item = prev[existingIndex];
        if (item.quantity >= prod.stock) {
          toast.error(`Cannot exceed available stock of ${prod.stock}`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...item,
          quantity: item.quantity + 1,
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product_id: prod.id,
            product_name: prod.name,
            price: Number(prod.price),
            quantity: 1,
            max_stock: prod.stock,
          },
        ];
      }
    });
  };

  const handleUpdateQty = (productId, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setOrderItems((prev) =>
      prev.map((item) => {
        if (item.product_id === productId) {
          if (newQty > item.max_stock) {
            toast.error(`Only ${item.max_stock} available in stock`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (productId) => {
    setOrderItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Handle payment method change: auto-suggest payment status
  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === 'unpaid') {
      setPaymentStatus('pending');
    } else {
      setPaymentStatus('verified');
    }
  };

  // Calculations
  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountVal = Math.min(Number(manualDiscount) || 0, subtotal);
  const grandTotal = Math.max(0, subtotal - discountVal);

  const resetForm = () => {
    setCustomerName('');
    setPhone('');
    setEmail('');
    setOrderType('pickup');
    setAddress('');
    setOrderItems([]);
    setPaymentMethod('cash');
    setPaymentStatus('verified');
    setOrderStatus('preparing');
    setManualDiscount('');
    setStaffNote('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!phone.trim()) {
      toast.error('Customer phone number is required');
      return;
    }
    if (orderItems.length === 0) {
      toast.error('Please add at least one cookie item to the order');
      return;
    }
    if (orderType === 'delivery' && !address.trim()) {
      toast.error('Delivery address is required for delivery orders');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          order_type: orderType,
          address: orderType === 'delivery' ? address.trim() : undefined,
          items: orderItems.map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
          })),
          manual_discount: discountVal > 0 ? discountVal : undefined,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          order_status: orderStatus,
          staff_note: staffNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Order ${data.order?.order_id || ''} created successfully!`);
        resetForm();
        if (onOrderCreated) {
          onOrderCreated(data.order);
        }
        onClose();
      } else {
        toast.error(data.error || 'Failed to create manual order');
      }
    } catch (err) {
      toast.error('Network error while creating order');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="➕ Key In Manual Order" maxWidth="880px">
      <form onSubmit={handleSubmit} className={styles.container}>

        {/* Top Info Notice */}
        <div className={styles.noticeBar}>
          💡 For Whatsapp Order or Walk-in Order
        </div>

        <div className={styles.mainGrid}>

          {/* LEFT COLUMN: Customer & Order Configuration */}
          <div className={styles.formCol}>

            {/* Customer Details */}
            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionTitle}>👤 Customer Details</h4>

              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  Customer Name <span className={styles.req}>*</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Tan Ah Kow"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.grid2}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>
                    Phone Number <span className={styles.req}>*</span>
                  </label>
                  <input
                    type="tel"
                    className={styles.input}
                    placeholder="e.g. 012-3456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>
                    Email <span className={styles.opt}>(Optional)</span>
                  </label>
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="customer@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Order Type Toggle */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>Fulfillment Type</label>
                <div className={styles.toggleRow}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${orderType === 'pickup' ? styles.toggleActive : ''}`}
                    onClick={() => setOrderType('pickup')}
                  >
                    🛍️ Pickup
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${orderType === 'delivery' ? styles.toggleActive : ''}`}
                    onClick={() => setOrderType('delivery')}
                  >
                    🚚 Delivery
                  </button>
                </div>
              </div>

              {orderType === 'delivery' && (
                <div className={styles.inputGroup}>
                  <label className={styles.label}>
                    Delivery Address <span className={styles.req}>*</span>
                  </label>
                  <textarea
                    rows="2"
                    className={styles.input}
                    placeholder="Enter full customer delivery address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            {/* Payment & Order Status Settings */}
            <div className={styles.sectionBlock}>
              <h4 className={styles.sectionTitle}>💳 Payment & Status</h4>

              <div className={styles.grid2}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Payment Method</label>
                  <select
                    className={styles.select}
                    value={paymentMethod}
                    onChange={(e) => handlePaymentMethodChange(e.target.value)}
                  >
                    <option value="qr_pay">📱 DuitNow / QR Pay</option>
                    <option value="card">💳 Card / Bank Transfer</option>
                    <option value="unpaid">⏳ Pay on Pickup / Later</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Payment Status</label>
                  <select
                    className={styles.select}
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="verified">Paid / Verified ✓</option>
                    <option value="pending">Pending Payment ⏳</option>
                  </select>
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Initial Order Status</label>
                  <select
                    className={styles.select}
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                  >
                    <option value="preparing">🧑‍🍳 Start Preparing</option>
                    <option value="ready_pickup">🛍️ Ready for Pickup</option>
                    <option value="completed">✅ Completed (Fulfilled)</option>
                    <option value="pending_verification">⏳ Pending Verification</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>
                    Discount (RM) <span className={styles.opt}>(Optional)</span>
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    className={styles.input}
                    placeholder="0.00"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  Staff Remark / Note <span className={styles.opt}>(Optional)</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Walk-in takeaway, customer requested ribbon"
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Product Catalog & Order Basket */}
          <div className={styles.itemsCol}>

            {/* Product Quick Picker */}
            <div className={styles.sectionBlock}>
              <div className={styles.catalogHeader}>
                <h4 className={styles.sectionTitle}>🍪 Select Products</h4>
                <input
                  type="text"
                  placeholder="Search cookie..."
                  className={styles.searchInput}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>

              {loadingProducts ? (
                <div style={{ padding: '20px 0' }}><LoadingSpinner /></div>
              ) : (
                <div className={styles.productPillsList}>
                  {filteredProducts.length === 0 ? (
                    <p className={styles.emptyNotice}>No products found</p>
                  ) : (
                    filteredProducts.map((prod) => {
                      const isOutOfStock = prod.stock <= 0 || prod.available === false;
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          disabled={isOutOfStock}
                          className={`${styles.productPill} ${isOutOfStock ? styles.pillDisabled : ''}`}
                          onClick={() => handleAddItem(prod)}
                        >
                          <div className={styles.pillInfo}>
                            <span className={styles.pillName}>{prod.name}</span>
                            <span className={styles.pillStock}>
                              {isOutOfStock ? 'Out of Stock' : `${prod.stock} in stock`}
                            </span>
                          </div>
                          <span className={styles.pillPrice}>RM{Number(prod.price).toFixed(2)}</span>
                          <span className={styles.pillAddIcon}>+</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Current Order Basket */}
            <div className={styles.basketBlock}>
              <h4 className={styles.sectionTitle}>
                🛍️ Current Basket ({orderItems.reduce((c, i) => c + i.quantity, 0)} items)
              </h4>

              {orderItems.length === 0 ? (
                <div className={styles.emptyBasket}>
                  <span>🛒</span>
                  <p>No cookies selected yet.</p>
                  <small>Click a product above to add to this order.</small>
                </div>
              ) : (
                <div className={styles.basketList}>
                  {orderItems.map((item) => (
                    <div key={item.product_id} className={styles.basketItem}>
                      <div className={styles.basketItemDetails}>
                        <span className={styles.basketItemName}>{item.product_name}</span>
                        <span className={styles.basketItemPrice}>
                          RM{item.price.toFixed(2)} each
                        </span>
                      </div>

                      <div className={styles.qtyControl}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => handleUpdateQty(item.product_id, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className={styles.qtyVal}>{item.quantity}</span>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          onClick={() => handleUpdateQty(item.product_id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>

                      <div className={styles.basketItemSubtotal}>
                        RM{(item.price * item.quantity).toFixed(2)}
                      </div>

                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleRemoveItem(item.product_id)}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Order Summary & Pricing */}
              <div className={styles.pricingSummary}>
                <div className={styles.summaryRow}>
                  <span>Subtotal:</span>
                  <span>RM{subtotal.toFixed(2)}</span>
                </div>
                {discountVal > 0 && (
                  <div className={`${styles.summaryRow} ${styles.discountText}`}>
                    <span>Discount:</span>
                    <span>-RM{discountVal.toFixed(2)}</span>
                  </div>
                )}
                <div className={styles.grandTotalRow}>
                  <span>Total Payable:</span>
                  <span className={styles.grandTotalAmount}>RM{grandTotal.toFixed(2)}</span>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className="btn btnSecondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btnPrimary"
            style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 700 }}
            disabled={submitting || orderItems.length === 0}
          >
            {submitting ? 'Creating Order...' : `✓ Create Order (RM${grandTotal.toFixed(2)})`}
          </button>
        </div>

      </form>
    </Modal>
  );
}
