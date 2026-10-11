'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, currencySymbol = '₱' }) {
  const { addItem, updateQuantity, removeItem, items } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : (product.image ? [product.image] : []);
  const hasMultipleImages = images.length > 1;

  const cartItem = items.find(i => i.product_id === product.id);
  const cartQuantity = cartItem ? cartItem.quantity : 0;
  const isAvailable = product.available !== false && product.available !== 0;
  const isUnavailable = !isAvailable;

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      toast.info('Please log in or register to order cookies.');
      router.push('/login');
      return;
    }

    if (isUnavailable) {
      toast.error('This cookie is currently unavailable');
      return;
    }
    addItem(product);
  };

  const handleIncrease = (e) => {
    e.stopPropagation();
    if (isUnavailable) {
      toast.error('This cookie is currently unavailable');
      return;
    }
    addItem(product);
  };

  const handleDecrease = (e) => {
    e.stopPropagation();
    if (cartQuantity <= 1) {
      removeItem(product.id);
      toast.info(`${product.name} removed from cart`);
    } else {
      updateQuantity(product.id, cartQuantity - 1);
    }
  };

  const openLightbox = (e) => {
    e.stopPropagation();
    if (images.length > 0) {
      setLightboxOpen(true);
    }
  };

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  return (
    <>
      <div className={`${styles.card} ${isUnavailable ? styles.outOfStock : ''}`}>
        {/* Left Side: Product Details */}
        <div className={styles.info}>
          <h3 className={styles.name}>{product.name}</h3>
          {product.description && (
            <p className={styles.description}>{product.description}</p>
          )}

          <div className={styles.bottom}>
            <span className={styles.price}>
              {currencySymbol}{Number(product.price).toFixed(2)}
            </span>

            {cartQuantity > 0 ? (
              <div className={styles.quantityControl}>
                <button 
                  className={styles.qtyBtn} 
                  onClick={handleDecrease}
                  type="button"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className={styles.qtyValue}>{cartQuantity}</span>
                <button 
                  className={styles.qtyBtn} 
                  onClick={handleIncrease}
                  type="button"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            ) : (
              <button 
                className={`${styles.addBtn} ${isUnavailable ? styles.disabled : ''}`}
                onClick={handleAdd}
                disabled={isUnavailable}
                type="button"
              >
                {isUnavailable ? 'Sold Out' : '+ Add'}
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Product Image Thumbnail */}
        <div className={styles.imageWrapper} onClick={openLightbox} title="Click to view photo">
          {images.length > 0 ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img 
              src={images[0]} 
              alt={product.name} 
              className={styles.image} 
            />
          ) : (
            <div className={styles.placeholder}>🍪</div>
          )}

          {isUnavailable && <div className={styles.soldOutBadge}>Unavailable</div>}

          {hasMultipleImages && (
            <div className={styles.imageCountBadge}>
              📸 {images.length}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal when clicked */}
      {lightboxOpen && images.length > 0 && (
        <div className={styles.modalOverlay} onClick={() => setLightboxOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <button 
              className={styles.modalCloseBtn} 
              onClick={() => setLightboxOpen(false)}
              aria-label="Close photo preview"
            >
              ✕
            </button>

            <div className={styles.modalImageWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={images[currentImgIndex]} 
                alt={`${product.name} ${currentImgIndex + 1}`} 
                className={styles.modalImage} 
              />

              {hasMultipleImages && (
                <>
                  <button className={`${styles.modalNavBtn} ${styles.modalPrevBtn}`} onClick={prevImage}>
                    ‹
                  </button>
                  <button className={`${styles.modalNavBtn} ${styles.modalNextBtn}`} onClick={nextImage}>
                    ›
                  </button>
                </>
              )}
            </div>

            <div className={styles.modalDetails}>
              {hasMultipleImages && (
                <div className={styles.modalDots}>
                  {images.map((_, idx) => (
                    <span 
                      key={idx} 
                      className={`${styles.modalDot} ${idx === currentImgIndex ? styles.modalDotActive : ''}`}
                      onClick={() => setCurrentImgIndex(idx)}
                    />
                  ))}
                </div>
              )}

              <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#111' }}>{product.name}</h4>
              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#666' }}>{product.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2c1d0f' }}>
                  {currencySymbol}{Number(product.price).toFixed(2)}
                </span>
                <button 
                  className={styles.addBtn}
                  onClick={(e) => {
                    handleAdd(e);
                    setLightboxOpen(false);
                  }}
                  disabled={isUnavailable}
                  style={{ padding: '8px 18px', fontSize: '0.9rem' }}
                >
                  {cartQuantity > 0 ? `In Cart (${cartQuantity})` : '+ Add to Cart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
