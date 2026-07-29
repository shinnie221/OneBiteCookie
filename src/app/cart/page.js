'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import styles from './page.module.css';

export default function CartPage() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart, setVoucher, removeVoucher, voucher, discount, subtotal, total, totalQuantity } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  
  const [voucherCode, setVoucherCode] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    
    setApplyingVoucher(true);
    try {
      const res = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: voucherCode, subtotal })
      });
      
      const data = await res.json();
      
      if (res.ok && data.valid) {
        setVoucher(data.voucher, data.voucher.discount_amount);
        toast.success(`Voucher applied! Saved RM${data.voucher.discount_amount.toFixed(2)}`);
        setVoucherCode('');
      } else {
        toast.error(data.error || 'Invalid voucher');
      }
    } catch (error) {
      toast.error('Error applying voucher');
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    removeVoucher();
    toast.info('Voucher removed');
  };

  return (
    <>
      <Navbar />
      
      <main className="pageContainer">
        <h1 className={styles.pageTitle}>Your Cart</h1>
        
        {items.length === 0 ? (
          <div className={styles.emptyCart}>
            <div className={styles.emptyIcon}>🛒</div>
            <h2>Your cart is empty</h2>
            <p>Looks like you haven't added any cookies yet.</p>
            <Link href="/" className="btn btnPrimary mt2">Browse Menu</Link>
          </div>
        ) : (
          <div className={styles.cartLayout}>
            <div className={styles.cartItems}>
              <div className={styles.cartHeader}>
                <span>Product</span>
                <span>Price</span>
                <span>Quantity</span>
                <span>Subtotal</span>
              </div>
              
              <div className={styles.itemsList}>
                {items.map(item => (
                  <div key={item.product_id} className={styles.cartItem}>
                    <div className={styles.itemInfo}>
                      <button 
                        className={styles.removeBtn} 
                        onClick={() => removeItem(item.product_id)}
                        title="Remove item"
                      >×</button>
                      <img src={item.image || 'data:image/svg+xml;base64,...'} alt={item.product_name} className={styles.itemImage} />
                      <div className={styles.itemDetails}>
                        <h3 className={styles.itemName}>{item.product_name}</h3>
                      </div>
                    </div>
                    
                    <div className={styles.itemPrice}>
                      RM{item.price.toFixed(2)}
                    </div>
                    
                    <div className={styles.itemQuantity}>
                      <div className={styles.quantityControl}>
                        <button className={styles.qtyBtn} onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>−</button>
                        <span className={styles.qty}>{item.quantity}</span>
                        <button 
                          className={styles.qtyBtn} 
                          onClick={() => {
                            if (item.quantity >= item.stock) {
                              toast.warning(`Only ${item.stock} available in stock`);
                              return;
                            }
                            updateQuantity(item.product_id, item.quantity + 1);
                          }}
                        >+</button>
                      </div>
                    </div>
                    
                    <div className={styles.itemSubtotal}>
                      RM{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className={styles.cartActions}>
                <button className="btn btnSecondary" onClick={clearCart}>Clear Cart</button>
                <Link href="/" className="btn btnOutline">Continue Shopping</Link>
              </div>
            </div>
            
            <div className={styles.orderSummary}>
              <h2 className={styles.summaryTitle}>Order Summary</h2>
              
              <div className={styles.summaryRow}>
                <span>Items ({totalQuantity}):</span>
                <span>RM{subtotal.toFixed(2)}</span>
              </div>
              
              {voucher && (
                <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                  <span>Discount ({voucher.code}): <button onClick={handleRemoveVoucher} className={styles.removeVoucherBtn}>Remove</button></span>
                  <span>-RM{discount.toFixed(2)}</span>
                </div>
              )}
              
              <div className={styles.summaryTotal}>
                <span>Total:</span>
                <span>RM{total.toFixed(2)}</span>
              </div>
              
              {!voucher && (
                <div className={styles.voucherSection}>
                  <p className={styles.voucherLabel}>Have a voucher code?</p>
                  <div className={styles.voucherInput}>
                    <input 
                      type="text" 
                      placeholder="Enter code" 
                      value={voucherCode} 
                      onChange={(e) => setVoucherCode(e.target.value)}
                    />
                    <button 
                      className="btn btnSecondary" 
                      onClick={handleApplyVoucher}
                      disabled={applyingVoucher || !voucherCode.trim()}
                    >
                      {applyingVoucher ? '...' : 'Apply'}
                    </button>
                  </div>
                </div>
              )}
              
              {isAuthenticated ? (
                <Link href="/checkout" className={`btn btnPrimary ${styles.checkoutBtn}`}>
                  Proceed to Checkout
                </Link>
              ) : (
                <button 
                  className={`btn btnPrimary ${styles.checkoutBtn}`} 
                  onClick={() => {
                    toast.info('Please log in to proceed to checkout');
                    router.push('/login');
                  }}
                  style={{ width: '100%' }}
                >
                  Login to Checkout
                </button>
              )}
            </div>
          </div>
        )}
      </main>
      
      <Footer />
    </>
  );
}
