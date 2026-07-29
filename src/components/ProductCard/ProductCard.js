'use client';

import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from 'next/navigation';
import styles from './ProductCard.module.css';

export default function ProductCard({ product }) {
  const { addItem, items } = useCart();
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
    toast.success(`${product.name} added to cart!`);
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
          <button 
            className={`${styles.addBtn} ${isFull || isOutOfStock ? styles.disabled : ''}`}
            onClick={handleAdd}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? 'Sold Out' : isFull ? 'Max Qty' : cartQuantity > 0 ? `Add More (${cartQuantity})` : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
