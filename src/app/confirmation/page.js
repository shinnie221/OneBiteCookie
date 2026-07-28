'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import OrderStatusBadge from '@/components/OrderStatusBadge/OrderStatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    
    fetch(`/api/orders/${orderId}`)
      .then(res => res.json())
      .then(data => {
        if (data.order) {
          setOrder(data.order);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return <LoadingSpinner text="Loading order details..." />;
  }

  if (!order) {
    return (
      <div className={styles.notFound}>
        <h2>Order Not Found</h2>
        <p>We couldn't find the order you're looking for.</p>
        <Link href="/" className="btn btnPrimary mt2">Back to Menu</Link>
      </div>
    );
  }

  return (
    <div className={styles.confirmationCard}>
      <div className={styles.successHeader}>
        <div className={styles.checkIcon}>✓</div>
        <h2>Thank you for your order!</h2>
        <p>Your payment is being verified by our staff. Please wait for confirmation.</p>
      </div>
      
      <div className={styles.orderMeta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Order ID</span>
          <span className={styles.metaValue}>{order.order_id}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Date</span>
          <span className={styles.metaValue}>
            {new Date(order.created_at).toLocaleString()}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Status</span>
          <OrderStatusBadge status={order.order_status} />
        </div>
      </div>
      
      <div className={styles.orderDetails}>
        <h3>Order Details</h3>
        
        <div className={styles.customerInfo}>
          <p><strong>Name:</strong> {order.customer_name}</p>
          <p><strong>Phone:</strong> {order.phone}</p>
          <p><strong>Type:</strong> {order.order_type === 'delivery' ? 'Delivery' : 'Store Pickup'}</p>
          {order.order_type === 'delivery' && (
            <p><strong>Address:</strong> {order.address}</p>
          )}
        </div>
        
        <div className={styles.itemsList}>
          {order.items.map((item, idx) => (
            <div key={idx} className={styles.itemRow}>
              <span>{item.quantity}x {item.product_name}</span>
              <span>RM{item.subtotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>Subtotal</span>
            <span>RM{order.subtotal.toFixed(2)}</span>
          </div>
          {order.discount > 0 && (
            <div className={`${styles.totalRow} ${styles.discount}`}>
              <span>Discount</span>
              <span>-RM{order.discount.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.finalTotal}>
            <span>Total Paid</span>
            <span>RM{order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <div className={styles.actions}>
        <Link href={`/track?id=${order.order_id}`} className="btn btnPrimary">
          Track Order Status
        </Link>
        <Link href="/" className="btn btnSecondary">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <>
      <Navbar />
      <main className="pageContainer">
        <Suspense fallback={<LoadingSpinner />}>
          <ConfirmationContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
