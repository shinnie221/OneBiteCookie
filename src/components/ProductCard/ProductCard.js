'use client';

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
  
  const cartItem = items.find(i => i.product_id === product.id);
  const cartQuantity = cartItem ? cartItem.quantity : 0;
  // Available or unavailable only (no stock quantity numbers shown to customers)
  const isAvailable = product.available !== false && product.available !== 0 && (product.stock === undefined || product.stock > 0);
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
        {product.image ? (
          <img src={product.image} alt={product.name} className={styles.image} />
        ) : (
          <div className={styles.placeholder}>🍪</div>
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
