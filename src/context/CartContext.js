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

  const addItem = useCallback((product) => {
    setItems(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        image: product.image,
        stock: product.stock,
        quantity: 1
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      setItems(prev => prev.filter(i => i.product_id !== productId));
    } else {
      setItems(prev => prev.map(i =>
        i.product_id === productId
          ? { ...i, quantity: Math.min(newQuantity, i.stock) }
          : i
      ));
    }
  }, []);

  const removeItem = useCallback((productId) => {
    setItems(prev => prev.filter(i => i.product_id !== productId));
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
