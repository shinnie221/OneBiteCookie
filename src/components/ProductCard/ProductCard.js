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
  const isOutOfStock = product.stock <= 0;
  const isFull = cartQuantity >= product.stock;

  const handleAdd = () => {
    if (!isAuthenticated) {
      toast.info('Please log in or register to order cookies.');
      router.push('/login');
      return;
    }

    if (isOutOfStock) {
      toast.error('This cookie is sold out!');
      return;
    }
    if (isFull) {
      toast.warning(`Only ${product.stock} available in stock`);
      return;
    }
    addItem(product);
  };

  const handleIncrease = () => {
    if (isFull) {
      toast.warning(`Only ${product.stock} available in stock`);
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
    <div className={`${styles.card} ${isOutOfStock ? styles.outOfStock : ''}`}>
      <div className={styles.imageWrapper}>
        {product.image ? (
          <img src={product.image} alt={product.name} className={styles.image} />
        ) : (
          <div className={styles.placeholder}>🍪</div>
        )}
        {isOutOfStock && <div className={styles.soldOutBadge}>Sold Out</div>}
        {!isOutOfStock && product.stock <= 5 && (
          <div className={styles.lowStockBadge}>Only {product.stock} left</div>
        )}
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
              >
                −
              </button>
              <span className={styles.qtyValue}>{cartQuantity}</span>
              <button 
                className={`${styles.qtyBtn} ${isFull ? styles.qtyBtnDisabled : ''}`} 
                onClick={handleIncrease}
                disabled={isFull}
                type="button"
              >
                +
              </button>
            </div>
          ) : (
            <button 
              className={`${styles.addBtn} ${isOutOfStock ? styles.disabled : ''}`}
              onClick={handleAdd}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
