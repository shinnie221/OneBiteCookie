'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { totalQuantity } = useCart();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>🍪</span>
          <span className={styles.logoText}>One Bite</span>
        </Link>

        <div className={`${styles.nav} ${mobileOpen ? styles.open : ''}`}>
          <Link href="/" className={styles.navLink} onClick={() => setMobileOpen(false)}>Home</Link>
          <Link href="/#menu" className={styles.navLink} onClick={() => setMobileOpen(false)}>Menu</Link>
          <Link href="/track" className={styles.navLink} onClick={() => setMobileOpen(false)}>Track Order</Link>
        </div>

        <div className={styles.actions}>
          <Link href="/cart" className={styles.cartBtn}>
            🛒
            {totalQuantity > 0 && (
              <span className={styles.badge}>{totalQuantity}</span>
            )}
          </Link>
          
          {isAuthenticated ? (
            <Link href="/staff/dashboard" className={styles.loginBtn}>Dashboard</Link>
          ) : (
            <Link href="/login" className={styles.loginBtn}>Staff Login</Link>
          )}

          <button className={styles.hamburger} onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)}></div>
      )}
    </nav>
  );
}
