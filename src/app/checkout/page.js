'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import {
  formatFullAddress,
  isStateDeliverable,
  WHATSAPP_INQUIRY_URL
} from '@/lib/addresses.mjs';
import styles from './page.module.css';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, discount, total, totalQuantity } = useCart();
  const { isAuthenticated, user, loading: authLoading, authFetch } = useAuth();
  const toast = useToast();

  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const hasRedirected = useRef(false);

  const [formData, setFormData] = useState({
    customer_name: user?.name || '',
    phone: '',
    email: user?.email || '',
    order_type: 'pickup',
    address: 'The Palette @ Danau Kota, Kuala Lumpur'
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        customer_name: user.name || prev.customer_name,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  // Load customer profile and saved delivery addresses directly from profile
  useEffect(() => {
    if (isAuthenticated) {
      authFetch('/api/user/profile')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user) {
            if (data.user.phone) {
              setFormData(prev => ({
                ...prev,
                phone: prev.phone || data.user.phone
              }));
            }
            if (Array.isArray(data.user.addresses) && data.user.addresses.length > 0) {
              setSavedAddresses(data.user.addresses);
              const defaultAddr = data.user.addresses.find(a => a.isDefault) || data.user.addresses[0];
              if (defaultAddr) {
                setSelectedAddressId(defaultAddr.id);
                if (formData.order_type === 'delivery') {
                  setFormData(prev => ({
                    ...prev,
                    address: formatFullAddress(defaultAddr)
                  }));
                }
              }
            }
          }
        })
        .catch(() => { });
    }
  }, [isAuthenticated, authFetch]);

  // Sync selected address into formData when selectedAddressId changes
  useEffect(() => {
    if (formData.order_type === 'delivery' && savedAddresses.length > 0 && selectedAddressId) {
      const matched = savedAddresses.find(a => a.id === selectedAddressId);
      if (matched) {
        setFormData(prev => ({
          ...prev,
          address: formatFullAddress(matched)
        }));
      }
    }
  }, [selectedAddressId, savedAddresses, formData.order_type]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        toast.info('Please log in to checkout');
        router.push('/login');
      }
      return;
    }

    // Check if cart is empty
    if (items.length === 0) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        toast.info('Your cart is empty');
        router.push('/cart');
      }
    }

    // Fetch settings to check if delivery is enabled
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings && data.settings.delivery_enabled === 'false') {
          setDeliveryEnabled(false);
          setFormData(prev => ({
            ...prev,
            order_type: 'pickup',
            address: 'The Palette @ Danau Kota, Kuala Lumpur'
          }));
        }
      })
      .catch(console.error);
  }, [items, router, toast, isAuthenticated, authLoading]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'order_type') {
      if (value === 'pickup') {
        setFormData(prev => ({
          ...prev,
          order_type: 'pickup',
          address: 'The Palette @ Danau Kota, Kuala Lumpur'
        }));
      } else {
        const matched = savedAddresses.find(a => a.id === selectedAddressId) || savedAddresses[0];
        setFormData(prev => ({
          ...prev,
          order_type: 'delivery',
          address: matched ? formatFullAddress(matched) : ''
        }));
      }
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectedAddr = savedAddresses.find(a => a.id === selectedAddressId) || savedAddresses[0];

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate contact info
    if (!formData.customer_name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    // Validate delivery order requirements
    if (formData.order_type === 'delivery') {
      if (savedAddresses.length === 0) {
        toast.error('No delivery address found in your profile. Please add an address in your profile first.');
        router.push('/profile');
        return;
      }

      if (!selectedAddr) {
        toast.error('Please select a delivery address from your profile');
        return;
      }

      if (!isStateDeliverable(selectedAddr.state)) {
        toast.error('Delivery is only available for Kuala Lumpur. Other states are not acceptable. Klang Valley customers can contact WhatsApp for inquiry, or choose Store Pickup.');
        return;
      }
    }

    const finalAddress = formData.order_type === 'delivery'
      ? (selectedAddr ? formatFullAddress(selectedAddr) : formData.address)
      : 'The Palette @ Danau Kota, Kuala Lumpur';

    // Save to local storage for payment page
    localStorage.setItem('onebite_checkout', JSON.stringify({
      customerInfo: {
        ...formData,
        address: finalAddress,
        pickup_time: formData.order_type === 'pickup' ? '11:00 AM' : null,
        delivery_state: formData.order_type === 'delivery'
          ? (selectedAddr?.state || 'Kuala Lumpur')
          : null
      }
    }));

    router.push('/payment');
  };

  if (authLoading || !isAuthenticated || items.length === 0) return null;

  return (
    <>
      <Navbar />

      <main className="pageContainer">
        <h1 className={styles.pageTitle}>Checkout</h1>

        <div className={styles.checkoutLayout}>
          <form className={styles.checkoutForm} onSubmit={handleSubmit}>
            <div className="card">
              <div className={styles.cardHeader}>
                <h2>Contact Information</h2>
              </div>
              <div className={styles.cardBody}>
                <div className="formGroup mb2">
                  <label htmlFor="customer_name">Full Name *</label>
                  <input
                    type="text"
                    id="customer_name"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    placeholder="e.g. Jane Doe"
                    required
                  />
                </div>

                <div className="formGroup mb2">
                  <label htmlFor="phone">Phone Number *</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g. 012-345 6789"
                    required
                  />
                </div>

                <div className="formGroup">
                  <label htmlFor="email">Email Address (Optional)</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>

            <div className={`card ${styles.mt4}`}>
              <div className={styles.cardHeader}>
                <h2>Order Fulfillment</h2>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.radioGroup}>
                  <label className={`${styles.radioCard} ${formData.order_type === 'pickup' ? styles.selected : ''}`}>
                    <input
                      type="radio"
                      name="order_type"
                      value="pickup"
                      checked={formData.order_type === 'pickup'}
                      onChange={handleInputChange}
                    />
                    <div className={styles.radioContent}>
                      <span className={styles.radioTitle}>Store Pickup</span>
                      <span className={styles.radioDesc}>Pick up at The Palette @ Danau Kota, KL (11:00 AM)</span>
                    </div>
                  </label>

                  {deliveryEnabled && (
                    <label className={`${styles.radioCard} ${formData.order_type === 'delivery' ? styles.selected : ''}`}>
                      <input
                        type="radio"
                        name="order_type"
                        value="delivery"
                        checked={formData.order_type === 'delivery'}
                        onChange={handleInputChange}
                      />
                      <div className={styles.radioContent}>
                        <span className={styles.radioTitle}>Delivery</span>
                        <span className={styles.radioDesc}>Delivered to your doorstep (Kuala Lumpur)</span>
                      </div>
                    </label>
                  )}
                </div>

                {/* STORE PICKUP LOCATION SECTION */}
                {formData.order_type === 'pickup' && (
                  <div className={styles.pickupLocationCard}>
                    <div className={styles.pickupLocationHeader}>
                      <span className={styles.pickupPinIcon}>📍</span>
                      <div>
                        <strong className={styles.pickupTitle}>Pickup Point: The Palette @ Danau Kota</strong>
                        <span className={styles.pickupSubtitle}>Store collection point in Setapak, Kuala Lumpur</span>
                      </div>
                    </div>

                    <div className={styles.pickupDetails}>
                      <p className={styles.pickupAddress}>
                        <strong>Address:</strong> The Palette, Danau Kota, 53300 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur
                      </p>
                      <p className={styles.pickupTime}>
                        ⏰ <strong>Pickup Time:</strong> 11:00 AM
                      </p>
                      <p className={styles.pickupNote}>
                        🕒 Ready for collection at <strong>11:00 AM</strong> once your order status is marked as <strong>Ready for Pickup</strong>.
                      </p>
                    </div>

                    <div className={styles.pickupLinks}>
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=The+Palette+Danau+Kota+Kuala+Lumpur"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.mapsLinkBtn}
                      >
                        🗺️ View on Google Maps ↗
                      </a>
                    </div>
                  </div>
                )}

                {/* DELIVERY ADDRESS SECTION (Directly from Profile) */}
                {formData.order_type === 'delivery' && (
                  <div className={`formGroup ${styles.mt4}`}>
                    {/* Delivery Notice */}
                    <div className={styles.klDeliveryNotice}>
                      <div className={styles.klDeliveryNoticeHeader}>
                        <span>📍 <strong>Delivery Notice (Kuala Lumpur Only)</strong></span>
                      </div>
                      <p className={styles.klDeliveryNoticeText}>
                        Online delivery is strictly specific to <strong>Kuala Lumpur</strong>. Other states are not acceptable. However, customers in the <strong>Klang Valley</strong> area can contact us on WhatsApp for delivery inquiry and special arrangements.
                      </p>
                      <a
                        href={WHATSAPP_INQUIRY_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.whatsappInquiryBtn}
                      >
                        💬 Inquire for Klang Valley Delivery via WhatsApp (011-10897061) ↗
                      </a>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ margin: 0, fontWeight: 700 }}>Delivery Address (From Profile) *</label>
                      <Link href="/profile" target="_blank" style={{ fontSize: '0.82rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                        ⚙️ Manage Addresses in Profile ↗
                      </Link>
                    </div>

                    {/* Case 1: Customer has NOT filled an address in profile -> Prompt and link */}
                    {savedAddresses.length === 0 ? (
                      <div className={styles.noAddressBox}>
                        <span className={styles.noAddressIcon}>📍</span>
                        <div className={styles.noAddressContent}>
                          <strong>No Delivery Address Found in Your Profile</strong>
                          <p>
                            Delivery addresses must be saved in your profile. You haven't added any delivery address yet. Please add your address in your profile to proceed with delivery.
                          </p>
                          <Link
                            href="/profile"
                            className="btn btnPrimary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', marginTop: '6px' }}
                          >
                            ➕ Add Delivery Address in Profile ↗
                          </Link>
                        </div>
                      </div>
                    ) : (
                      /* Case 2: Customer has saved addresses in profile -> Pick and display */
                      <div>
                        {savedAddresses.length > 1 && (
                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', display: 'block', marginBottom: '6px' }}>
                              Select from your profile addresses:
                            </label>
                            <select
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--color-border)',
                                font: 'inherit',
                                fontSize: '0.9rem',
                                background: 'white',
                                color: 'var(--color-text)'
                              }}
                              value={selectedAddressId}
                              onChange={e => setSelectedAddressId(e.target.value)}
                            >
                              {savedAddresses.map(a => {
                                const deliverable = isStateDeliverable(a.state);
                                return (
                                  <option key={a.id} value={a.id}>
                                    {deliverable ? '🚚 ' : '⚠️ [Outside KL] '}
                                    {a.isDefault ? '⭐ [Default] ' : ''}
                                    {a.label}: {a.recipientName} - {a.addressLine1}, {a.city}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        {selectedAddr && (
                          <div className={styles.selectedAddressCard}>
                            <div className={styles.selectedAddressHeader}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={styles.selectedAddressBadge}>
                                  {selectedAddr.label || 'Home'}
                                </span>
                                {selectedAddr.isDefault && (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>
                                    ⭐ Default
                                  </span>
                                )}
                                {isStateDeliverable(selectedAddr.state) ? (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#047857', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>
                                    🚚 KL Delivery
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                                    ⚠️ Outside KL
                                  </span>
                                )}
                              </div>
                              <Link
                                href="/profile"
                                style={{ fontSize: '0.82rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}
                              >
                                ✏️ Edit in Profile ↗
                              </Link>
                            </div>

                            <div className={styles.selectedRecipient}>
                              <span>{selectedAddr.recipientName}</span>
                              <span className={styles.selectedPhone}>📞 {selectedAddr.phone}</span>
                            </div>

                            <p className={styles.selectedAddressLines}>
                              {formatFullAddress(selectedAddr)}
                            </p>
                          </div>
                        )}

                        {/* If chosen address is not in KL, show non-KL warning */}
                        {selectedAddr && !isStateDeliverable(selectedAddr.state) && (
                          <div className={styles.nonKlBlockAlert}>
                            <div className={styles.nonKlBlockTitle}>
                              🚫 Delivery Not Acceptable for Selected State
                            </div>
                            <p>
                              Your selected address state is <strong>{selectedAddr.state}</strong>. Online delivery is only available within <strong>Kuala Lumpur</strong>. Other states are not acceptable. However, if your address is located within the <strong>Klang Valley</strong> area, please contact us on WhatsApp for inquiry.
                            </p>
                            <div className={styles.nonKlActions}>
                              <a
                                href={WHATSAPP_INQUIRY_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btnSecondary"
                              >
                                💬 WhatsApp Klang Valley Inquiry (011-10897061)
                              </a>
                              <button
                                type="button"
                                className="btn btnPrimary"
                                onClick={() => setFormData(prev => ({ ...prev, order_type: 'pickup' }))}
                              >
                                🛍️ Switch to Store Pickup
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className={`btn btnPrimary ${styles.submitBtn} ${styles.mt4}`}
              disabled={formData.order_type === 'delivery' && savedAddresses.length === 0}
            >
              {formData.order_type === 'delivery' && savedAddresses.length === 0
                ? 'Please Add Delivery Address in Profile'
                : 'Continue to Payment'
              }
            </button>
          </form>

          <div className={styles.orderSummary}>
            <div className="card">
              <div className={styles.cardHeader}>
                <h2>Order Summary</h2>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.summaryItems}>
                  {items.map(item => (
                    <div key={item.product_id} className={styles.summaryItem}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemQty}>{item.quantity}x</span>
                        <span className={styles.itemName}>{item.product_name}</span>
                      </div>
                      <span className={styles.itemPrice}>RM{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.summaryTotals}>
                  <div className={styles.totalRow}>
                    <span>Subtotal</span>
                    <span>RM{subtotal.toFixed(2)}</span>
                  </div>

                  {discount > 0 && (
                    <div className={`${styles.totalRow} ${styles.discountRow}`}>
                      <span>Discount</span>
                      <span>-RM{discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className={styles.finalTotal}>
                    <span>Total</span>
                    <span>RM{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
