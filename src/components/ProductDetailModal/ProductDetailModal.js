'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { getProductPackagingOptions, getProductPriceRange, formatPrice } from '@/lib/packaging';
import {
  X,
  Cookie,
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Sparkles,
  Minus,
  Plus,
  Maximize2
} from 'lucide-react';
import styles from './ProductDetailModal.module.css';

export default function ProductDetailModal({ product, isOpen, onClose, currencySymbol = '₱', onOpenByob = null }) {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const images = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length > 0) return product.images;
    if (product.image) return [product.image];
    return [];
  }, [product]);

  const packagingOptions = useMemo(() => {
    return getProductPackagingOptions(product);
  }, [product]);

  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState(() => packagingOptions[0]?.id || 'piece');
  const [quantity, setQuantity] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Sync favorites
  useEffect(() => {
    if (product?.id) {
      try {
        const favs = JSON.parse(localStorage.getItem('onebite_favorites') || '[]');
        setIsFavorited(favs.includes(product.id));
      } catch (e) {
        setIsFavorited(false);
      }
    }
  }, [product?.id]);

  // Disable background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const isAvailable = product.available !== false && product.available !== 0;
  const selectedOption = packagingOptions.find(o => o.id === selectedOptionId) || packagingOptions[0] || {
    id: 'piece',
    name: 'Per piece',
    price: Number(product.price) || 0,
    pieces: 1
  };

  const unitPrice = Number(selectedOption.price) || 0;
  const totalPrice = unitPrice * quantity;
  const priceRangeString = getProductPriceRange(product, currencySymbol);

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    try {
      const favs = JSON.parse(localStorage.getItem('onebite_favorites') || '[]');
      let updated;
      if (favs.includes(product.id)) {
        updated = favs.filter(id => id !== product.id);
        setIsFavorited(false);
        toast.info(`Removed ${product.name} from favorites`);
      } else {
        updated = [...favs, product.id];
        setIsFavorited(true);
        toast.success(`Saved ${product.name} to favorites`);
      }
      localStorage.setItem('onebite_favorites', JSON.stringify(updated));
    } catch (err) { }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}/#${encodeURIComponent(product.name)}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          toast.success('Link copied to clipboard!');
        }).catch(() => {
          toast.info('Share link: ' + shareUrl);
        });
      }
    }
  };

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.info('Please log in or register to order cookies.');
      router.push('/login');
      return;
    }

    if (!isAvailable) {
      toast.error('This cookie is currently unavailable');
      return;
    }

    addItem(product, selectedOption, quantity);
    toast.success(`Added ${quantity}x ${product.name} (${selectedOption.name}) to cart!`);
    onClose();
  };

  const hasMultipleImages = images.length > 1;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close detail modal"
        >
          <X size={20} />
        </button>

        {/* Top Product Image */}
        <div className={styles.mediaContainer}>
          {images.length > 0 ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <>
              <img
                src={images[currentImgIndex]}
                alt={product.name}
                className={styles.productImg}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onClick={() => setIsLightboxOpen(true)}
                title="Tap to view full photo"
              />
              <button
                type="button"
                className={styles.expandBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLightboxOpen(true);
                }}
                aria-label="View full photo"
                title="View full photo"
              >
                <Maximize2 size={15} />
              </button>
            </>
          ) : (
            <div className={styles.placeholderImg}>
              <Cookie size={48} strokeWidth={1.5} />
            </div>
          )}

          {hasMultipleImages && (
            <>
              <button
                type="button"
                className={`${styles.navBtn} ${styles.prevBtn}`}
                onClick={() => setCurrentImgIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))}
                aria-label="Previous photo"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                className={`${styles.navBtn} ${styles.nextBtn}`}
                onClick={() => setCurrentImgIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))}
                aria-label="Next photo"
              >
                <ChevronRight size={22} />
              </button>

              <div className={styles.dotsWrap}>
                {images.map((_, idx) => (
                  <span
                    key={idx}
                    className={`${styles.dot} ${idx === currentImgIndex ? styles.dotActive : ''}`}
                    onClick={() => setCurrentImgIndex(idx)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Scrollable Content */}
        <div className={styles.contentBody}>
          {/* Header Row: Title & Actions */}
          <div className={styles.headerRow}>
            <h2 className={styles.productTitle}>{product.name}</h2>
            <div className={styles.actionIcons}>
              <button
                type="button"
                className={`${styles.iconBtn} ${isFavorited ? styles.iconBtnActive : ''}`}
                onClick={handleToggleFavorite}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                aria-label="Favorite"
              >
                <Heart
                  size={18}
                  fill={isFavorited ? '#e11d48' : 'none'}
                  color={isFavorited ? '#e11d48' : 'currentColor'}
                />
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={handleShare}
                title="Share product link"
                aria-label="Share"
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>

          {/* Price Range */}
          <div className={styles.priceRange}>
            {priceRangeString}
          </div>

          {/* Description */}
          {product.description && (
            <div className={styles.descriptionWrap}>
              <p className={`${styles.descriptionText} ${!descExpanded ? styles.descriptionClamped : ''}`}>
                {product.description}
              </p>
              {product.description.length > 70 && (
                <button
                  type="button"
                  className={styles.toggleDescBtn}
                  onClick={() => setDescExpanded(prev => !prev)}
                >
                  {descExpanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          <hr className={styles.divider} />

          {/* Packaging Options Radio Group */}
          <div className={styles.optionsList}>
            {packagingOptions.map(option => {
              const isSelected = option.id === selectedOptionId;
              return (
                <div
                  key={option.id}
                  className={`${styles.optionItem} ${isSelected ? styles.optionItemActive : ''}`}
                  onClick={() => setSelectedOptionId(option.id)}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                >
                  <div className={styles.optionLeft}>
                    <div className={`${styles.radioCircle} ${isSelected ? styles.radioCircleChecked : ''}`}>
                      {isSelected && <div className={styles.radioDot} />}
                    </div>
                    <span className={styles.optionName}>{option.name}</span>
                  </div>

                  <span className={styles.optionPrice}>
                    {currencySymbol}{formatPrice(option.price)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hint banner for customers who want mixed flavors */}
          {onOpenByob && (
            <div className={styles.byobHintBox}>
              <div className={styles.byobHintText}>
                <div className={styles.byobHintTitle}>
                  <Sparkles size={15} className={styles.byobHintIcon} />
                  <span>
                    Want to <strong>mix & match flavors</strong> in a box?
                  </span>
                </div>
                <span className={styles.byobHintSub}>This option is a single-flavor box of {product.name}.</span>
              </div>
              <div className={styles.byobHintBtnRow}>
                <button
                  type="button"
                  className={styles.byobHintBtn}
                  onClick={onOpenByob}
                >
                  Build Your Own Box
                </button>
              </div>
            </div>
          )}

          <hr className={styles.divider} />

          {/* Quantity Stepper */}
          <div className={styles.quantityRow}>
            <span className={styles.quantityLabel}>Quantity</span>
            <div className={styles.quantityStepper}>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                disabled={quantity <= 1 || !isAvailable}
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className={styles.stepperValue}>{quantity}</span>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setQuantity(prev => prev + 1)}
                disabled={!isAvailable}
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Add Button */}
        <div className={styles.bottomFooter}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleAddToCart}
            disabled={!isAvailable}
          >
            {isAvailable ? `Add to Cart · ${currencySymbol}${formatPrice(totalPrice)}` : 'Sold Out'}
          </button>
        </div>
      </div>

      {/* Fullscreen Photo Lightbox */}
      {isLightboxOpen && images.length > 0 && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            className={styles.lightboxCloseBtn}
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Close photo view"
          >
            <X size={24} />
          </button>

          {hasMultipleImages && (
            <>
              <button
                type="button"
                className={`${styles.lightboxNavBtn} ${styles.lightboxPrevBtn}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImgIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                aria-label="Previous photo"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                className={`${styles.lightboxNavBtn} ${styles.lightboxNextBtn}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImgIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                aria-label="Next photo"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
            <img
              src={images[currentImgIndex]}
              alt={product.name}
              className={styles.lightboxImg}
            />
            <div className={styles.lightboxCaption}>
              <span>{product.name}</span>
              {hasMultipleImages && (
                <span>{currentImgIndex + 1} / {images.length}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
