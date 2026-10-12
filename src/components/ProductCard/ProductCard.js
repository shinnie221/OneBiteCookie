'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import ProductDetailModal from '@/components/ProductDetailModal/ProductDetailModal';
import ByobModal from '@/components/ByobModal/ByobModal';
import { getProductPriceRange } from '@/lib/packaging';
import styles from './ProductCard.module.css';

export default function ProductCard({ product, currencySymbol = '₱', allProducts = [] }) {
  const { items } = useCart();
  const [modalOpen, setModalOpen] = useState(false);

  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : (product.image ? [product.image] : []);
  const hasMultipleImages = images.length > 1;

  // Total quantity in cart across all variants for this product
  const cartQuantity = items
    .filter(i => i.product_id === product.id)
    .reduce((sum, i) => sum + (i.quantity || 1), 0);

  const isAvailable = product.available !== false && product.available !== 0;
  const isUnavailable = !isAvailable;

  const priceRange = getProductPriceRange(product, currencySymbol);

  const handleOpenModal = (e) => {
    if (e) e.stopPropagation();
    setModalOpen(true);
  };

  return (
    <>
      <div 
        className={`${styles.card} ${isUnavailable ? styles.outOfStock : ''}`}
        onClick={handleOpenModal}
        role="button"
        tabIndex={0}
      >
        {/* Left Side: Product Details */}
        <div className={styles.info}>
          <h3 className={styles.name}>{product.name}</h3>
          {product.description && (
            <p className={styles.description}>{product.description}</p>
          )}

          <div className={styles.bottom}>
            <span className={styles.price}>
              {priceRange}
            </span>

            <button 
              className={`${styles.addBtn} ${isUnavailable ? styles.disabled : ''}`}
              onClick={handleOpenModal}
              disabled={isUnavailable}
              type="button"
            >
              {isUnavailable 
                ? 'Sold Out' 
                : (cartQuantity > 0 
                    ? `In Cart (${cartQuantity})` 
                    : (product.is_byob ? '+ 选配礼盒' : '+ Add'))}
            </button>
          </div>
        </div>

        {/* Right Side: Product Image Thumbnail */}
        <div className={styles.imageWrapper} onClick={handleOpenModal} title="Click to view options">
          {images.length > 0 ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img 
              src={images[0]} 
              alt={product.name} 
              className={styles.image} 
            />
          ) : (
            <div className={styles.placeholder}>🎁</div>
          )}

          {isUnavailable && <div className={styles.soldOutBadge}>Unavailable</div>}

          {hasMultipleImages && (
            <div className={styles.imageCountBadge}>
              📸 {images.length}
            </div>
          )}
        </div>
      </div>

      {/* Modal: ByobModal or ProductDetailModal */}
      {product.is_byob ? (
        <ByobModal
          key={`${product.id}_${modalOpen}`}
          product={product}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          currencySymbol={currencySymbol}
          allProducts={allProducts}
        />
      ) : (
        <ProductDetailModal
          key={`${product.id}_${modalOpen}`}
          product={product}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          currencySymbol={currencySymbol}
        />
      )}
    </>
  );
}
