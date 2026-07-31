'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function PaymentPage() {
  const router = useRouter();
  const { items, total, voucher, clearCart } = useCart();
  const { authFetch } = useAuth();
  const toast = useToast();
  
  const [checkoutData, setCheckoutData] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Check if coming from checkout
    const savedCheckout = localStorage.getItem('onebite_checkout');
    if (!savedCheckout || items.length === 0) {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        toast.error('Please complete checkout first');
        router.push('/cart');
      }
      return;
    }
    
    setCheckoutData(JSON.parse(savedCheckout));
    
    // Fetch QR code
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings && data.settings.qr_code) {
          setQrCode(data.settings.qr_code);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [items, router, toast]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    
    if (!selected.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    setFile(selected);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target.result);
    reader.readAsDataURL(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file || !previewUrl) {
      toast.error('Please upload a payment screenshot');
      return;
    }
    if (!confirmed) {
      toast.error('Please confirm that you have made the payment');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // previewUrl is already a base64 string
      const paymentScreenshotBase64 = previewUrl;

      // Submit order
      const orderPayload = {
        ...checkoutData.customerInfo,
        items: items.map(i => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity })),
        voucher_code: voucher ? voucher.code : null,
        payment_screenshot: paymentScreenshotBase64
      };
      
      const orderRes = await authFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      
      const orderData = await orderRes.json();
      
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to submit order');
      }
      
      // Clear data and redirect
      hasRedirected.current = true;
      localStorage.removeItem('onebite_checkout');
      clearCart();
      toast.success('Order submitted successfully!');
      router.push(`/confirmation?id=${orderData.order.order_id}`);
      
    } catch (error) {
      toast.error(error.message || 'An error occurred during payment');
      setSubmitting(false);
    }
  };

  if (loading || !checkoutData) {
    return (
      <>
        <Navbar />
        <main className="pageContainer" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingSpinner text="Preparing payment..." />
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      
      <main className="pageContainer">
        <h1 className={styles.pageTitle}>Complete Payment</h1>
        
        <div className={styles.paymentContainer}>
          <div className={`card ${styles.paymentCard}`}>
            <div className={styles.amountBox}>
              <span className={styles.amountLabel}>Amount to Pay</span>
              <span className={styles.amountValue}>RM{total.toFixed(2)}</span>
            </div>
            
            <div className={styles.qrSection}>
              <h3>Scan to Pay</h3>
              <p>Please scan the QR code using your mobile banking app or e-wallet.</p>
              
              <div className={styles.qrWrapper}>
                {qrCode ? (
                  <img src={qrCode} alt="Payment QR Code" className={styles.qrImage} />
                ) : (
                  <div className={styles.qrPlaceholder}>QR Code Unavailable</div>
                )}
              </div>
              
              <p className={styles.bankInfo}>
                <strong>One Bite Cookie Shop</strong><br/>
                Reference: Checkout
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.uploadForm}>
              <div className={styles.uploadSection}>
                <h3>Upload Payment Proof</h3>
                <p>After transferring RM{total.toFixed(2)}, please upload a screenshot of your successful transaction.</p>
                
                <div className={styles.fileUploadWrapper}>
                  <input 
                    type="file" 
                    id="payment_proof" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className={styles.fileInput}
                  />
                  <label htmlFor="payment_proof" className={styles.fileLabel}>
                    <span className={styles.uploadIcon}>📸</span>
                    <span className={styles.uploadText}>
                      {file ? file.name : 'Tap to select or take a screenshot'}
                    </span>
                  </label>
                </div>
                
                {previewUrl && (
                  <div className={styles.previewBox}>
                    <img src={previewUrl} alt="Payment Preview" className={styles.previewImage} />
                  </div>
                )}
              </div>
              
              <div className={styles.confirmationBox}>
                <label className={styles.checkboxLabel}>
                  <input 
                    type="checkbox" 
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>I confirm that I have transferred RM{total.toFixed(2)} to One Bite.</span>
                </label>
              </div>
              
              <button 
                type="submit" 
                className={`btn btnPrimary ${styles.submitBtn}`}
                disabled={submitting || !file || !confirmed}
              >
                {submitting ? 'Submitting Order...' : 'Submit Order'}
              </button>
            </form>
          </div>
        </div>
      </main>
      
      <Footer />
    </>
  );
}
