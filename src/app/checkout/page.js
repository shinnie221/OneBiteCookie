'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import styles from './page.module.css';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, discount, total, totalQuantity } = useCart();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const toast = useToast();
  
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const hasRedirected = useRef(false);
  
  const [formData, setFormData] = useState({
    customer_name: user?.name || '',
    phone: '',
    email: user?.email || '',
    order_type: 'pickup',
    address: ''
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
          setFormData(prev => ({ ...prev, order_type: 'pickup' }));
        }
      })
      .catch(console.error);
  }, [items, router, toast, isAuthenticated, authLoading]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate
    if (!formData.customer_name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }
    if (formData.order_type === 'delivery' && !formData.address.trim()) {
      toast.error('Please enter your delivery address');
      return;
    }
    
    // Save to local storage for the payment page to pick up
    localStorage.setItem('onebite_checkout', JSON.stringify({
      customerInfo: formData
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
                <h2>Order Type</h2>
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
                      <span className={styles.radioDesc}>Pick up at 123 Cookie Lane, KL</span>
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
                        <span className={styles.radioDesc}>Delivered to your doorstep</span>
                      </div>
                    </label>
                  )}
                </div>
                
                {formData.order_type === 'delivery' && (
                  <div className={`formGroup ${styles.mt4}`}>
                    <label htmlFor="address">Delivery Address *</label>
                    <textarea 
                      id="address" 
                      name="address" 
                      rows="3" 
                      value={formData.address} 
                      onChange={handleInputChange} 
                      required 
                    ></textarea>
                  </div>
                )}
              </div>
            </div>
            
            <button type="submit" className={`btn btnPrimary ${styles.submitBtn} ${styles.mt4}`}>
              Continue to Payment
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
