'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Navbar from '@/components/Navbar/Navbar';
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
  const [currencySymbol, setCurrencySymbol] = useState('RM');

  // Fetch available visible vouchers and settings on mount
  useEffect(() => {
    let isMounted = true;
    const fetchFn = isAuthenticated ? authFetch : fetch;
    fetchFn('/api/vouchers/public')
      .then(res => res.ok ? res.json() : { vouchers: [] })
      .then(data => {
        if (!isMounted) return;
        if (data.vouchers) setPublicVouchers(data.vouchers);
        setLoadingVouchers(false);
      })
      .catch(() => {
        if (isMounted) setLoadingVouchers(false);
      });

    fetch('/api/settings')
      .then(r => r.ok ? r.json() : { settings: {} })
      .then(d => {
        if (isMounted && d.settings?.currency_symbol) {
          setCurrencySymbol(d.settings.currency_symbol);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, authFetch]);

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
            <p>Looks like you haven&apos;t added any cookies yet.</p>
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
                {items.map((item, idx) => {
                  const itemKey = item.cart_item_id || `${item.product_id}_${item.variant || 'piece'}_${idx}`;
                  const itemIdentifier = item.cart_item_id || item.product_id;
                  return (
                    <div key={itemKey} className={styles.cartItem}>
                      <div className={styles.itemInfo}>
                        <button 
                          className={styles.removeBtn} 
                          onClick={() => removeItem(itemIdentifier, item.variant)}
                          title="Remove item"
                        >×</button>
                        <img src={item.image || 'data:image/svg+xml;base64,...'} alt={item.product_name} className={styles.itemImage} />
                        <div className={styles.itemDetails}>
                          <h3 className={styles.itemName}>{item.product_name}</h3>
                          {item.variant && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: '#6f4827',
                              background: '#f6ede4',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              width: 'fit-content'
                            }}>
                              {item.variant === 'Per piece' ? '🍪 Per piece' : `📦 ${item.variant}`}
                            </span>
                          )}
                          {item.flavour_summary && (
                            <div style={{
                              fontSize: '0.76rem',
                              color: '#666',
                              marginTop: '4px',
                              lineHeight: 1.35,
                              background: '#faf6f0',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px dashed #e2d2c1'
                            }}>
                              🎁 <strong>Flavors:</strong> {item.flavour_summary}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className={styles.itemPrice}>
                        {currencySymbol}{Number(item.price).toFixed(2)}
                      </div>
                      
                      <div className={styles.itemQuantity}>
                        <div className={styles.quantityControl}>
                          <button 
                            className={styles.qtyBtn} 
                            onClick={() => updateQuantity(itemIdentifier, item.quantity - 1, item.variant)}
                          >−</button>
                          <span className={styles.qty}>{item.quantity}</span>
                          <button 
                            className={styles.qtyBtn} 
                            onClick={() => updateQuantity(itemIdentifier, item.quantity + 1, item.variant)}
                          >+</button>
                        </div>
                      </div>
                      
                      <div className={styles.itemSubtotal}>
                        {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
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
                <span>{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              
              {voucher && (
                <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                  <span>
                    Discount ({voucher.code}):{' '}
                    <button onClick={handleRemoveVoucher} className={styles.removeVoucherBtn}>
                      Remove
                    </button>
                  </span>
                  <span>-{currencySymbol}{discount.toFixed(2)}</span>
                </div>
              )}
              
              <div className={styles.summaryTotal}>
                <span>Total:</span>
                <span>{currencySymbol}{total.toFixed(2)}</span>
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
    </>
  );
}
