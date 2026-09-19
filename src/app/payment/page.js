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

function compressImage(file, maxDimension = 1000, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (file.type && !file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      return reject(new Error('Please select a valid image file'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image preview'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          // Fallback to raw data url if canvas operation fails
          resolve(e.target.result);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function PaymentPage() {
  const router = useRouter();
  const { items, total, voucher, clearCart } = useCart();
  const { authFetch } = useAuth();
  const toast = useToast();
  
  const [checkoutData, setCheckoutData] = useState(null);
  const deliveryFee = checkoutData?.customerInfo?.delivery_fee || 0;
  const grandTotal = total + deliveryFee;
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const fileInputRef = useRef(null);
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

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    
    if (selected.type && !selected.type.startsWith('image/') && !selected.name.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i)) {
      toast.error('Please upload an image file (PNG, JPG, JPEG, WebP)');
      return;
    }
    
    if (selected.size > 20 * 1024 * 1024) {
      toast.error('Image size is too large (max 20MB)');
      return;
    }

    setCompressing(true);
    setFile(selected);
    
    try {
      const compressedDataUrl = await compressImage(selected);
      setPreviewUrl(compressedDataUrl);
    } catch (err) {
      console.error('Image processing error:', err);
      toast.error('Could not process this image. Please try another.');
      setFile(null);
      setPreviewUrl(null);
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setConfirmed(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
              <span className={styles.amountValue}>RM{grandTotal.toFixed(2)}</span>
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
                <p>After transferring RM{grandTotal.toFixed(2)}, please upload a screenshot of your successful transaction.</p>
                
                <div className={styles.fileUploadWrapper}>
                  <input 
                    type="file" 
                    id="payment_proof" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className={styles.fileInput}
                    ref={fileInputRef}
                  />
                  <label htmlFor="payment_proof" className={styles.fileLabel}>
                    <span className={styles.uploadIcon}>📸</span>
                    <span className={styles.uploadText}>
                      {compressing 
                        ? 'Optimizing photo...' 
                        : (file ? file.name : 'Tap to select or take a screenshot')}
                    </span>
                  </label>
                </div>
                
                {previewUrl && (
                  <div className={styles.previewBox}>
                    <button 
                      type="button"
                      className={styles.removePreviewBtn}
                      onClick={handleRemoveFile}
                      title="Remove screenshot"
                    >
                      ✕
                    </button>
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
                disabled={submitting || compressing || !file || !confirmed}
              >
                {submitting ? 'Submitting Order...' : compressing ? 'Optimizing photo...' : 'Submit Order'}
              </button>
            </form>
          </div>
        </div>
      </main>
      
      <Footer />
    </>
  );
}
