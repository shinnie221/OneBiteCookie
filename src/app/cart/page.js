'use client';

import { useState, useEffect } from 'react';
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
  const { isAuthenticated, authFetch } = useAuth();
  const toast = useToast();
  
  const [voucherCode, setVoucherCode] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [publicVouchers, setPublicVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);

  // Fetch available visible vouchers on mount and when authentication changes
  useEffect(() => {
    fetchPublicVouchers();
  }, [isAuthenticated]);

  const fetchPublicVouchers = async () => {
    setLoadingVouchers(true);
    try {
      const fetchFn = isAuthenticated ? authFetch : fetch;
      const res = await fetchFn('/api/vouchers/public');
      const data = await res.json();
      if (res.ok && data.vouchers) {
        setPublicVouchers(data.vouchers);
      }
    } catch (error) {
      console.error('Failed to load available vouchers:', error);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const applyVoucherCode = async (codeToApply) => {
    const code = (codeToApply || voucherCode).trim();
    if (!code) return;
    
    setApplyingVoucher(true);
    try {
      const fetchFn = isAuthenticated ? authFetch : fetch;
      const res = await fetchFn('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal })
      });
      
      const data = await res.json();
      
      if (res.ok && data.valid) {
        setVoucher(data.voucher, data.voucher.discount_amount);
        toast.success(`Voucher "${data.voucher.code}" applied! Saved RM${data.voucher.discount_amount.toFixed(2)}`);
        setVoucherCode('');
      } else {
        toast.error(data.error || 'Invalid or inapplicable voucher');
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
                  <span>
                    Discount ({voucher.code}):{' '}
                    <button onClick={handleRemoveVoucher} className={styles.removeVoucherBtn}>
                      Remove
                    </button>
                  </span>
                  <span>-RM{discount.toFixed(2)}</span>
                </div>
              )}
              
              <div className={styles.summaryTotal}>
                <span>Total:</span>
                <span>RM{total.toFixed(2)}</span>
              </div>
              
              {/* Voucher Section */}
              <div className={styles.voucherSection}>
                
                {/* 1. Visible Public Vouchers (Only show if no voucher currently applied) */}
                {!voucher && publicVouchers.length > 0 && (
                  <div className={styles.publicVouchersContainer}>
                    <p className={styles.voucherLabel}>🎟️ Available Vouchers for You</p>
                    <div className={styles.voucherCardsList}>
                      {publicVouchers.map((v) => {
                        const canApply = subtotal >= v.min_order;
                        const diff = (v.min_order - subtotal).toFixed(2);
                        const isSingleUse = v.usage_limit === 'once_total' || v.usage_limit === 'once_per_customer';
                        
                        return (
                          <div key={v.id} className={`${styles.voucherCard} ${v.is_targeted ? styles.voucherCardTargeted : ''}`}>
                            <div className={styles.voucherCardLeft}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div className={styles.voucherCardBadge}>{v.code}</div>
                                {v.is_targeted && (
                                  <span className={styles.exclusiveBadge}>🎁 Exclusive For You</span>
                                )}
                              </div>
                              <div className={styles.voucherCardDiscount}>
                                {v.discount_type === 'percentage'
                                  ? `${v.discount_value}% OFF`
                                  : `RM${Number(v.discount_value).toFixed(2)} OFF`}
                              </div>
                              <div className={styles.voucherCardTerms}>
                                {v.min_order > 0 ? `Min spend RM${Number(v.min_order).toFixed(2)}` : 'No minimum spend'}
                                {isSingleUse && ' • Single-use'}
                              </div>
                            </div>
                            
                            <div className={styles.voucherCardRight}>
                              {canApply ? (
                                <button
                                  type="button"
                                  className={styles.applyCardBtn}
                                  onClick={() => applyVoucherCode(v.code)}
                                  disabled={applyingVoucher}
                                >
                                  Apply
                                </button>
                              ) : (
                                <span className={styles.minSpendHint}>
                                  +RM{diff} more
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Manual Voucher Code Input (for secret / invisible / custom codes) */}
                {!voucher && (
                  <div className={styles.manualCodeBlock}>
                    <p className={styles.voucherSubLabel}>
                      {publicVouchers.length > 0 ? 'Have a secret or other promo code?' : 'Have a voucher code?'}
                    </p>
                    <div className={styles.voucherInput}>
                      <input 
                        type="text" 
                        placeholder="Enter voucher code" 
                        value={voucherCode} 
                        onChange={(e) => setVoucherCode(e.target.value)}
                      />
                      <button 
                        className="btn btnSecondary" 
                        onClick={() => applyVoucherCode()}
                        disabled={applyingVoucher || !voucherCode.trim()}
                      >
                        {applyingVoucher ? '...' : 'Apply'}
                      </button>
                    </div>
                  </div>
                )}

              </div>
              
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
