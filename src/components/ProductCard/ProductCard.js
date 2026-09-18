'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import styles from './ProductCard.module.css';

export default function ProductCard({ product }) {
  const { addItem, updateQuantity, removeItem, items } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : (product.image ? [product.image] : []);
  const hasMultipleImages = images.length > 1;

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };
  
  const cartItem = items.find(i => i.product_id === product.id);
  const cartQuantity = cartItem ? cartItem.quantity : 0;
  // Available or unavailable only (controlled by staff toggle, no stock numbers shown)
  const isAvailable = product.available !== false && product.available !== 0;
  const isUnavailable = !isAvailable;

  const handleAdd = () => {
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

  const handleIncrease = () => {
    if (isUnavailable) {
      toast.error('This cookie is currently unavailable');
      return;
    }
    addItem(product);
  };

  const handleDecrease = () => {
    if (cartQuantity <= 1) {
      removeItem(product.id);
      toast.info(`${product.name} removed from cart`);
    } else {
      updateQuantity(product.id, cartQuantity - 1);
    }
  };

  return (
    <div className={`${styles.card} ${isUnavailable ? styles.outOfStock : ''}`}>
      <div className={styles.imageWrapper}>
        {images.length > 0 ? (
          <img 
            src={images[currentImgIndex]} 
            alt={`${product.name} (Photo ${currentImgIndex + 1})`} 
            className={styles.image} 
          />
        ) : (
          <div className={styles.placeholder}>🍪</div>
        )}

        {hasMultipleImages && (
          <>
            <button 
              type="button" 
              className={`${styles.navBtn} ${styles.prevBtn}`}
              onClick={handlePrevImage}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button 
              type="button" 
              className={`${styles.navBtn} ${styles.nextBtn}`}
              onClick={handleNextImage}
              aria-label="Next photo"
            >
              ›
            </button>
            <div className={styles.dotsIndicator}>
              {images.map((_, idx) => (
                <span 
                  key={idx} 
                  className={`${styles.dot} ${idx === currentImgIndex ? styles.activeDot : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImgIndex(idx);
                  }}
                />
              ))}
            </div>
            <span className={styles.imageCounter}>
              {currentImgIndex + 1}/{images.length}
            </span>
          </>
        )}

        {isUnavailable && <div className={styles.soldOutBadge}>Unavailable</div>}
      </div>
      
      <div className={styles.info}>
        <h3 className={styles.name}>{product.name}</h3>
        <p className={styles.description}>{product.description}</p>
        
        <div className={styles.bottom}>
          <span className={styles.price}>RM{product.price.toFixed(2)}</span>
          
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
            >
              {isUnavailable ? 'Unavailable' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
