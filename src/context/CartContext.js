'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [voucher, setVoucherState] = useState(null);
  const [discount, setDiscount] = useState(0);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('onebite_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        setItems(parsed.items || []);
        setVoucherState(parsed.voucher || null);
        setDiscount(parsed.discount || 0);
      }
    } catch (e) {}
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('onebite_cart', JSON.stringify({ items, voucher, discount }));
  }, [items, voucher, discount]);

  const addItem = useCallback((product, option = null, quantityToAdd = 1) => {
    const variantName = option?.name || 'Per piece';
    const variantId = option?.id || (variantName === 'Per piece' ? 'piece' : variantName);
    const variantPieces = option?.pieces || 1;
    const price = option?.price !== undefined ? Number(option.price) : Number(product.price);
    const cartItemId = `${product.id}_${variantId}`;

    setItems(prev => {
      const existing = prev.find(i => 
        (i.cart_item_id && i.cart_item_id === cartItemId) ||
        (i.product_id === product.id && (i.variant === variantName || (!i.variant && variantName === 'Per piece')))
      );

      if (existing) {
        return prev.map(i => {
          const isMatch = (i.cart_item_id && i.cart_item_id === cartItemId) ||
            (i.product_id === product.id && (i.variant === variantName || (!i.variant && variantName === 'Per piece')));
          return isMatch ? { ...i, quantity: i.quantity + quantityToAdd } : i;
        });
      }

      return [...prev, {
        cart_item_id: cartItemId,
        product_id: product.id,
        product_name: product.name,
        variant: variantName,
        variant_id: variantId,
        variant_pieces: variantPieces,
        price: price,
        image: (Array.isArray(product.images) && product.images[0]) || product.image || '',
        quantity: quantityToAdd
      }];
    });
  }, []);

  const updateQuantity = useCallback((cartItemIdOrProductId, newQuantity, variantName = null) => {
    if (newQuantity <= 0) {
      setItems(prev => prev.filter(i => {
        if (i.cart_item_id && i.cart_item_id === cartItemIdOrProductId) return false;
        if (variantName && i.product_id === cartItemIdOrProductId && i.variant === variantName) return false;
        if (!variantName && !i.cart_item_id && i.product_id === cartItemIdOrProductId) return false;
        if (!variantName && i.product_id === cartItemIdOrProductId && (!i.variant || i.variant === 'Per piece')) return false;
        return true;
      }));
    } else {
      setItems(prev => prev.map(i => {
        const matches = (i.cart_item_id && i.cart_item_id === cartItemIdOrProductId)
          || (variantName && i.product_id === cartItemIdOrProductId && i.variant === variantName)
          || (!variantName && !i.cart_item_id && i.product_id === cartItemIdOrProductId)
          || (!variantName && i.product_id === cartItemIdOrProductId && (!i.variant || i.variant === 'Per piece'));
        return matches ? { ...i, quantity: newQuantity } : i;
      }));
    }
  }, []);

  const removeItem = useCallback((cartItemIdOrProductId, variantName = null) => {
    setItems(prev => prev.filter(i => {
      if (i.cart_item_id && i.cart_item_id === cartItemIdOrProductId) return false;
      if (variantName && i.product_id === cartItemIdOrProductId && i.variant === variantName) return false;
      if (!variantName && !i.cart_item_id && i.product_id === cartItemIdOrProductId) return false;
      if (!variantName && i.product_id === cartItemIdOrProductId && (!i.variant || i.variant === 'Per piece')) return false;
      return true;
    }));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setVoucherState(null);
    setDiscount(0);
  }, []);

  const setVoucher = useCallback((v, discountAmt) => {
    setVoucherState(v);
    setDiscount(discountAmt);
  }, []);

  const removeVoucher = useCallback(() => {
    setVoucherState(null);
    setDiscount(0);
  }, []);

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - discount);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, addItem, updateQuantity, removeItem, clearCart,
      voucher, discount, setVoucher, removeVoucher,
      subtotal, total, totalQuantity
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
