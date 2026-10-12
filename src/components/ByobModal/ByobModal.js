'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import { getByobTiers, formatPrice } from '@/lib/packaging';
import styles from './ByobModal.module.css';

export default function ByobModal({ product, isOpen, onClose, currencySymbol = 'RM', allProducts = [] }) {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const router = useRouter();

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

    toast.success(`Added ${boxQuantity}x ${selectedTier.name} to cart! 🎁`);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2 className={styles.title}>Build Your Own Box 🎁</h2>
            <p className={styles.subtitle}>自选混装礼盒 · 挑选你最喜爱的口味</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.contentBody}>
          {/* Step 1: Choose Box Size */}
          <div>
            <div className={styles.sectionTitle}>
              <span>第一步：选择礼盒规格 (Box Size)</span>
            </div>

            <div className={styles.tierGrid}>
              {tiers.map(tier => {
                const isSelected = tier.id === selectedTierId;
                const isBoxOf5 = tier.pieces === 5;
                return (
                  <div
                    key={tier.id}
                    className={`${styles.tierCard} ${isSelected ? styles.tierCardActive : ''}`}
                    onClick={() => handleSelectTier(tier.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.tierCardHeader}>
                      <span className={styles.tierName}>{tier.name}</span>
                      {isBoxOf5 && (
                        <span className={styles.tierBadge}>五种口味齐聚 ⭐</span>
                      )}
                    </div>
                    <span className={styles.tierPrice}>
                      {currencySymbol}{formatPrice(tier.price)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Flavour Selection Progress Bar */}
          <div className={styles.progressCard}>
            <div className={styles.progressTop}>
              <span className={styles.progressText}>
                {isFull 
                  ? `✅ 礼盒已选满 (${totalSelectedCount}/${targetCount} 片)` 
                  : `🍪 已选 ${totalSelectedCount} / ${targetCount} 片（还需选 ${remainingCount} 片）`}
              </span>
              <div className={styles.quickActions}>
                {targetCount === 5 && availableFlavours.length >= 5 && (
                  <button type="button" className={styles.quickBtn} onClick={handleFillOneOfEach}>
                    ⭐ 各一口味 (共5片)
                  </button>
                )}
                {totalSelectedCount > 0 && (
                  <button type="button" className={styles.quickBtn} onClick={handleClearSelection}>
                    清空
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

          {/* Step 3: Flavours List */}
          <div>
            <div className={styles.sectionTitle}>
              <span>第二步：搭配口味 (Pick Flavours)</span>
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
                    <div className={styles.flavourLeft}>
                      {thumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={thumb} alt={flavor.name} className={styles.flavourThumb} />
                      ) : (
                        <div className={styles.flavourThumb} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                          🍪
                        </div>
                      )}
                      <div className={styles.flavourInfo}>
                        <span className={styles.flavourName}>{flavor.name}</span>
                        {pickedCount > 0 && (
                          <span className={styles.flavourPickedCount}>已选 {pickedCount} 片</span>
                        )}
                      </div>
                    </div>

                    <div className={styles.flavourStepper}>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => handleRemoveFlavour(flavor.id)}
                        disabled={pickedCount <= 0}
                        aria-label="Decrease"
                      >
                        −
                      </button>
                      <span className={styles.stepperValue}>{pickedCount}</span>
                      <button
                        type="button"
                        className={styles.stepperBtn}
                        onClick={() => handleAddFlavour(flavor.id)}
                        disabled={totalSelectedCount >= targetCount}
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 4: Box Quantity */}
          <div className={styles.boxQtyRow}>
            <span className={styles.boxQtyLabel}>购买礼盒数量 (Boxes)</span>
            <div className={styles.flavourStepper}>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setBoxQuantity(prev => Math.max(1, prev - 1))}
                disabled={boxQuantity <= 1}
              >
                −
              </button>
              <span className={styles.stepperValue}>{boxQuantity}</span>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setBoxQuantity(prev => prev + 1)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.bottomFooter}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleAddToCart}
            disabled={!isFull}
          >
            {isFull 
              ? `加入购物车 · ${currencySymbol}${formatPrice(totalPrice)}` 
              : `请再选择 ${remainingCount} 片曲奇放入礼盒`}
          </button>
        </div>
      </div>
    </div>
  );
}
