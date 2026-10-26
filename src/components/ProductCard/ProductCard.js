'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import ProductDetailModal from '@/components/ProductDetailModal/ProductDetailModal';
import ByobModal from '@/components/ByobModal/ByobModal';
import { getProductPriceRange } from '@/lib/packaging';
import { Cookie, Camera, ShoppingCart } from 'lucide-react';
import styles from './ProductCard.module.css';

export default function ProductCard({
  product,
  currencySymbol = 'RM',
  allProducts = [],
  priority = false
}) {
  const { items } = useCart();
  const [modalOpen, setModalOpen] = useState(false);
  const [byobModalOpen, setByobModalOpen] = useState(false);

  const byobProduct = allProducts.find(p => p.is_byob);

  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.image ? [product.image] : []);
  const hasMultipleImages = images.length > 1;

  // Cart quantity for this product across variants
  const cartQuantity = items
    .filter(i => i.product_id === product.id)
    .reduce((sum, i) => sum + (i.quantity || 1), 0);

  const isAvailable = product.available !== false && product.available !== 0;
  const isUnavailable = !isAvailable;

  const priceDisplay = getProductPriceRange(product, currencySymbol);

  const handleOpenModal = (e) => {
    if (e) e.stopPropagation();
    setModalOpen(true);
  };

  const handleOpenByobFromDetail = () => {
    setModalOpen(false);
    setByobModalOpen(true);
  };

  return (
    <>
      <div
        className={`${styles.card} ${isUnavailable ? styles.outOfStock : ''}`}
        onClick={handleOpenModal}
        role="button"
        tabIndex={0}
      >
        {/* Top Product Image: Square Box */}
        <div className={styles.imageWrapper}>
          {images.length > 0 ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={images[0]}
              alt={product.name}
              className={styles.image}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
            />
          ) : (
            <div className={styles.placeholder}>
              <Cookie size={36} strokeWidth={1.5} />
            </div>
          )}

          {/* Multiple Photos Indicator */}
          {hasMultipleImages && (
            <div className={styles.imageCountBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Camera size={13} /> {images.length}
            </div>
          )}

          {/* Sold Out Overlay */}
          {isUnavailable && <div className={styles.soldOutBadge}>Sold Out</div>}
        </div>

        {/* Bottom Content Body */}
        <div className={styles.info}>
          <div className={styles.infoTop}>
            {product.is_byob && (
              <span className={styles.byobBadge}>Custom Box</span>
            )}
            <h3 className={styles.name}>{product.name}</h3>
            {product.description && (
              <p className={styles.description}>{product.description}</p>
            )}
          </div>

          {/* Bottom Action Row: Price & Add to Cart Option */}
          <div className={styles.bottomRow}>
            <span className={styles.price}>{priceDisplay}</span>

            <button
              type="button"
              className={`${styles.addBtn} ${cartQuantity > 0 ? styles.addBtnInCart : ''} ${isUnavailable ? styles.disabled : ''}`}
              onClick={handleOpenModal}
              disabled={isUnavailable}
              aria-label={isUnavailable ? 'Sold Out' : (cartQuantity > 0 ? `In cart (${cartQuantity})` : 'Add to cart')}
              title={isUnavailable ? 'Sold Out' : (cartQuantity > 0 ? `In cart (${cartQuantity})` : 'Add to cart')}
            >
              <ShoppingCart size={15} />
              {cartQuantity > 0 && (
                <span className={styles.cartBadge}>{cartQuantity}</span>
              )}
            </button>
          </div>
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
          onOpenByob={byobProduct ? handleOpenByobFromDetail : null}
        />
      )}

      {/* Bridge BYOB Modal when triggered from a single product modal */}
      {byobModalOpen && byobProduct && (
        <ByobModal
          product={byobProduct}
          isOpen={byobModalOpen}
          onClose={() => setByobModalOpen(false)}
          currencySymbol={currencySymbol}
          allProducts={allProducts}
        />
      )}
    </>
  );
}
