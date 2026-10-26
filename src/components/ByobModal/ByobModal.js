'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { getByobTiers, formatPrice } from '@/lib/packaging';
import {
  X,
  Cookie,
  ChevronLeft,
  ChevronRight,
  Heart,
  Share2,
  Sparkles,
  CheckCircle,
  Search,
  Minus,
  Plus
} from 'lucide-react';
import styles from './ByobModal.module.css';

export default function ByobModal({ product, isOpen, onClose, currencySymbol = '₱', allProducts = [] }) {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

  // BYOB Product Images Carousel
  const images = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.images) && product.images.length > 0) return product.images;
    if (product.image) return [product.image];
    return [];
  }, [product]);

  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const hasMultipleImages = images.length > 1;

  // Favorites & Share State
  const [isFavorited, setIsFavorited] = useState(false);
  const [previewFlavour, setPreviewFlavour] = useState(null);
  const [previewImgIndex, setPreviewImgIndex] = useState(0);

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
      const shareUrl = `${window.location.origin}/#${encodeURIComponent(product.name || 'byob')}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          toast.success('Link copied to clipboard!');
        }).catch(() => {
          toast.info('Share link: ' + shareUrl);
        });
      }
    }
  };

  const tiers = useMemo(() => {
    return getByobTiers(product);
  }, [product]);

  // Default to Box of 5 (or first tier)
  const defaultTierId = tiers.find(t => t.pieces === 5)?.id || tiers[0]?.id || 'box_5';
  const [selectedTierId, setSelectedTierId] = useState(defaultTierId);
  const [boxQuantity, setBoxQuantity] = useState(1);

  // Available flavours from the catalog (exclude the BYOB box itself)
  const availableFlavours = useMemo(() => {
    return (allProducts || []).filter(p => !p.is_byob && p.available !== false && p.available !== 0);
  }, [allProducts]);

  // Selection state: { [productId]: count }
  const [selectedFlavours, setSelectedFlavours] = useState({});

  const selectedTier = tiers.find(t => t.id === selectedTierId) || tiers[0];
  const targetCount = selectedTier?.pieces || 5;

  const totalSelectedCount = useMemo(() => {
    return Object.values(selectedFlavours).reduce((sum, count) => sum + (Number(count) || 0), 0);
  }, [selectedFlavours]);

  const remainingCount = targetCount - totalSelectedCount;
  const isFull = totalSelectedCount === targetCount;

  // Handle Box Size change
  const handleSelectTier = (tierId) => {
    setSelectedTierId(tierId);
    const newTier = tiers.find(t => t.id === tierId);
    const newTarget = newTier?.pieces || 4;

    // If current selections exceed the new target, reset or trim
    if (totalSelectedCount > newTarget) {
      setSelectedFlavours({});
    }
  };

  // Stepper handlers
  const handleAddFlavour = (prodId) => {
    if (totalSelectedCount >= targetCount) return;
    setSelectedFlavours(prev => ({
      ...prev,
      [prodId]: (prev[prodId] || 0) + 1
    }));
  };

  const handleRemoveFlavour = (prodId) => {
    setSelectedFlavours(prev => {
      const current = prev[prodId] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }
      return {
        ...prev,
        [prodId]: current - 1
      };
    });
  };

  // Quick Action: Fill 1 of each flavour
  const handleFillOneOfEach = () => {
    const newSelection = {};
    const countToFill = Math.min(availableFlavours.length, targetCount);
    for (let i = 0; i < countToFill; i++) {
      newSelection[availableFlavours[i].id] = 1;
    }
    setSelectedFlavours(newSelection);
  };

  const handleClearSelection = () => {
    setSelectedFlavours({});
  };

  // Open flavor photo preview
  const handleOpenFlavourPreview = (flavor, e) => {
    if (e) e.stopPropagation();
    setPreviewFlavour(flavor);
    setPreviewImgIndex(0);
  };

  // Disable background scrolling
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

  const tierPrice = Number(selectedTier?.price || 0);
  const totalPrice = tierPrice * boxQuantity;

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.info('Please log in or register to order cookies.');
      router.push('/login');
      return;
    }

    if (!isFull) {
      toast.error(`Please select ${remainingCount} more cookie(s) to fill this box.`);
      return;
    }

    // Build flavour details list and summary text
    const flavourList = Object.entries(selectedFlavours)
      .filter(([_, count]) => count > 0)
      .map(([prodId, count]) => {
        const matched = availableFlavours.find(p => p.id === prodId);
        return {
          product_id: prodId,
          name: matched?.name || 'Cookie',
          quantity: count
        };
      });

    const flavourSummary = flavourList
      .map(f => `${f.quantity}x ${f.name}`)
      .join(', ');

    addItem(
      product,
      {
        id: selectedTier.id,
        name: selectedTier.name,
        pieces: selectedTier.pieces,
        price: selectedTier.price
      },
      boxQuantity,
      {
        is_byob: true,
        flavours: flavourList,
        flavour_summary: flavourSummary
      }
    );

    toast.success(`Added ${boxQuantity}x ${selectedTier.name} to cart!`);
    onClose();
  };

  const previewImages = previewFlavour
    ? (Array.isArray(previewFlavour.images) && previewFlavour.images.length > 0
        ? previewFlavour.images
        : (previewFlavour.image ? [previewFlavour.image] : []))
    : [];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Floating Close Button */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Top Product Image Carousel (Shows BYOB photos like cookie detail modal) */}
        <div className={styles.mediaContainer}>
          {images.length > 0 ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={images[currentImgIndex]}
              alt={product.name || 'Build Your Own Box'}
              className={styles.productImg}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
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

        {/* Scrollable Content Body */}
        <div className={styles.contentBody}>
          {/* Header Row: Title & Actions */}
          <div className={styles.headerRow}>
            <div className={styles.titleArea}>
              <h2 className={styles.title}>{product.name || 'Build Your Own Box'}</h2>
              <p className={styles.subtitle}>
                {product.description || 'Custom Gift Box · Mix & match your favorite flavors'}
              </p>
            </div>
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
                title="Share BYOB link"
                aria-label="Share"
              >
                <Share2 size={18} />
              </button>
            </div>
          </div>

          {/* Step 1: Choose Box Size */}
          <div className={styles.sectionWrap}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionTitle}>Step 1: Choose Box Size</span>
              <span className={styles.currentTierHighlight}>
                {selectedTier?.name} · {currencySymbol}{formatPrice(selectedTier?.price)}
              </span>
            </div>

            <div className={styles.tierGrid}>
              {tiers.map(tier => {
                const isSelected = tier.id === selectedTierId;
                const isBoxOf5 = tier.pieces === 5;
                return (
                  <button
                    type="button"
                    key={tier.id}
                    className={`${styles.tierChip} ${isSelected ? styles.tierChipActive : ''}`}
                    onClick={() => handleSelectTier(tier.id)}
                  >
                    <span className={styles.tierChipPieces}>{tier.pieces} Pieces</span>
                    <span className={styles.tierChipPrice}>{currencySymbol}{formatPrice(tier.price)}</span>
                    {isBoxOf5 && (
                      <span className={styles.tierChipBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Sparkles size={11} /> Try All 5
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Flavour Selection Progress Bar */}
          <div className={styles.progressCard}>
            <div className={styles.progressTop}>
              <div className={styles.progressText}>
                {isFull ? (
                  <span className={styles.progressLabel}>
                    <CheckCircle size={15} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span className={styles.progressTextColumn}>
                      <span className={styles.progressMainText}>Box is full</span>
                      <span className={styles.progressSubText}>({totalSelectedCount}/{targetCount} cookies)</span>
                    </span>
                  </span>
                ) : (
                  <span className={styles.progressLabel}>
                    <Cookie size={15} style={{ color: '#d97706', flexShrink: 0 }} />
                    <span className={styles.progressTextColumn}>
                      <span className={styles.progressMainText}>Selected {totalSelectedCount} / {targetCount}</span>
                      <span className={styles.progressSubText}>({remainingCount} more needed)</span>
                    </span>
                  </span>
                )}
              </div>
              <div className={styles.quickActions}>
                {targetCount === 5 && availableFlavours.length >= 5 && (
                  <button
                    type="button"
                    className={styles.quickBtn}
                    onClick={handleFillOneOfEach}
                  >
                    <Sparkles size={12} /> 1 of Each (5 Total)
                  </button>
                )}
                {totalSelectedCount > 0 && (
                  <button type="button" className={styles.clearBtn} onClick={handleClearSelection}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className={styles.progressBarWrap}>
              <div
                className={styles.progressBarFill}
                style={{
                  width: `${Math.min(100, (totalSelectedCount / targetCount) * 100)}%`,
                  backgroundColor: isFull ? '#22c55e' : '#d97706'
                }}
              />
            </div>
          </div>

          {/* Step 3: Flavours List with Photo Thumbnails & Preview */}
          <div className={styles.sectionWrap}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionTitle}>Step 2: Pick Flavors</span>
              <span className={styles.sectionSubtitle}>
                Tap photo to view · [+] to add
              </span>
            </div>

            <div className={styles.flavourList}>
              {availableFlavours.map(flavor => {
                const pickedCount = selectedFlavours[flavor.id] || 0;
                const thumb = (flavor.images && flavor.images[0]) || flavor.image;
                return (
                  <div
                    key={flavor.id}
                    className={`${styles.flavourItem} ${pickedCount > 0 ? styles.flavourItemPicked : ''}`}
                  >
                    <div
                      className={styles.flavourLeft}
                      onClick={(e) => handleOpenFlavourPreview(flavor, e)}
                      title="Click to view photo & details"
                    >
                      <div className={styles.flavourThumbWrap}>
                        {thumb ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={thumb}
                            alt={flavor.name}
                            className={styles.flavourThumb}
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className={styles.flavourThumbFallback}>
                            <Cookie size={22} strokeWidth={1.5} />
                          </div>
                        )}
                        <span className={styles.flavourZoomIcon} aria-hidden="true">
                          <Search size={11} />
                        </span>
                      </div>

                      <div className={styles.flavourInfo}>
                        <span className={styles.flavourName}>{flavor.name}</span>
                        {pickedCount > 0 && (
                          <span className={styles.flavourPickedCount}>{pickedCount} selected</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.flavourStepper}>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => handleRemoveFlavour(flavor.id)}
                        disabled={pickedCount <= 0}
                        aria-label={`Decrease ${flavor.name}`}
                      >
                        <Minus size={13} />
                      </button>
                      <span className={styles.stepperValue}>{pickedCount}</span>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => handleAddFlavour(flavor.id)}
                        disabled={totalSelectedCount >= targetCount}
                        aria-label={`Increase ${flavor.name}`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: Box Quantity */}
          <div className={styles.boxQtyRow}>
            <span className={styles.boxQtyLabel}>Number of Boxes</span>
            <div className={styles.flavourStepper}>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setBoxQuantity(prev => Math.max(1, prev - 1))}
                disabled={boxQuantity <= 1}
                aria-label="Decrease boxes"
              >
                <Minus size={13} />
              </button>
              <span className={styles.stepperValue}>{boxQuantity}</span>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setBoxQuantity(prev => prev + 1)}
                aria-label="Increase boxes"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className={styles.bottomFooter}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleAddToCart}
            disabled={!isFull}
          >
            {isFull
              ? `Add to Cart · ${currencySymbol}${formatPrice(totalPrice)}`
              : `Please select ${remainingCount} more cookie${remainingCount > 1 ? 's' : ''}`}
          </button>
        </div>

        {/* Quick Cookie Photo Lightbox Preview */}
        {previewFlavour && (
          <div className={styles.previewOverlay} onClick={() => setPreviewFlavour(null)}>
            <div className={styles.previewCard} onClick={e => e.stopPropagation()}>
              <div className={styles.previewImageWrap}>
                {previewImages.length > 0 ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewImages[previewImgIndex]}
                    alt={previewFlavour.name}
                    className={styles.previewImg}
                  />
                ) : (
                  <div className={styles.placeholderImg}>
                    <Cookie size={48} strokeWidth={1.5} />
                  </div>
                )}

                <button
                  type="button"
                  className={styles.previewCloseBtn}
                  onClick={() => setPreviewFlavour(null)}
                  aria-label="Close photo preview"
                >
                  <X size={20} />
                </button>

                {previewImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      className={`${styles.navBtn} ${styles.prevBtn}`}
                      onClick={() => setPreviewImgIndex(prev => (prev === 0 ? previewImages.length - 1 : prev - 1))}
                      aria-label="Previous photo"
                    >
                      <ChevronLeft size={22} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.navBtn} ${styles.nextBtn}`}
                      onClick={() => setPreviewImgIndex(prev => (prev === previewImages.length - 1 ? 0 : prev + 1))}
                      aria-label="Next photo"
                    >
                      <ChevronRight size={22} />
                    </button>
                    <div className={styles.dotsWrap}>
                      {previewImages.map((_, idx) => (
                        <span
                          key={idx}
                          className={`${styles.dot} ${idx === previewImgIndex ? styles.dotActive : ''}`}
                          onClick={() => setPreviewImgIndex(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.previewBody}>
                <h3 className={styles.previewTitle}>{previewFlavour.name}</h3>
                {previewFlavour.description && (
                  <p className={styles.previewDesc}>{previewFlavour.description}</p>
                )}
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className={styles.previewAddBtn}
                    onClick={() => {
                      handleAddFlavour(previewFlavour.id);
                      setPreviewFlavour(null);
                    }}
                    disabled={totalSelectedCount >= targetCount}
                  >
                    {totalSelectedCount >= targetCount
                      ? 'Box is Full'
                      : `+ Add to Box (${selectedFlavours[previewFlavour.id] || 0} in box)`}
                  </button>
                  <button
                    type="button"
                    className={styles.previewBackBtn}
                    onClick={() => setPreviewFlavour(null)}
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
