'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { totalQuantity } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isCartOrProfile = pathname?.startsWith('/cart') || pathname?.startsWith('/profile') || pathname?.startsWith('/checkout') || pathname?.startsWith('/payment');

  const handleLogout = () => {
    logout();
    router.push('/');
  };

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
          <Link href="/orders" className={styles.navLink} onClick={() => setMobileOpen(false)}>My Orders</Link>

          {isAuthenticated && user?.role !== 'customer' && (
            <Link href="/staff/dashboard" className={styles.navLink} onClick={() => setMobileOpen(false)}>Staff Dashboard</Link>
          )}

          {isAuthenticated && user?.role === 'customer' && (
            <div className={styles.mobileAuthSection}>
              <div className={styles.mobileAuthButtons}>
                <button 
                  type="button"
                  className={styles.mobileLogoutBtn}
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div className={styles.mobileAuthSection}>
              <div className={styles.mobileAuthButtons}>
                <Link 
                  href="/login" 
                  className={styles.mobileLoginBtn}
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In / Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {!isCartOrProfile && (
            <Link href="/cart" className={styles.cartBtn} aria-label="Cart">
              🛒
              {totalQuantity > 0 && (
                <span className={styles.badge}>{totalQuantity}</span>
              )}
            </Link>
          )}
          
          {!isCartOrProfile && (
            isAuthenticated ? (
              <>
                {user?.role === 'customer' ? (
                  <Link href="/profile" className={styles.loginBtn}>Profile</Link>
                ) : (
                  <Link href="/staff/dashboard" className={styles.loginBtn}>Dashboard</Link>
                )}
              </>
            ) : (
              <Link href="/login" className={styles.loginBtn}>Sign In</Link>
            )
          )}

          <button 
            className={styles.hamburger} 
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
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
