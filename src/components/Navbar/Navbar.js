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

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleMenuClick = (e) => {
    setMobileOpen(false);
    if (pathname === '/') {
      e.preventDefault();
      const menuEl = document.getElementById('menu');
      if (menuEl) {
        menuEl.scrollIntoView({ behavior: 'smooth' });
        if (typeof window !== 'undefined') {
          window.history.pushState(null, '', '#menu');
        }
      }
    }
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.navLeft}>
          <button 
            type="button"
            className={styles.hamburger} 
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>

          <Link href="/" className={styles.desktopLogo}>
            <img src="/logo.png" alt="One Bite" className={styles.brandLogoImg} />
          </Link>
        </div>

        {/* Mobile Center Title (Matches Home & Menu Header) */}
        <Link href="/" className={styles.mobileCenterTitle}>
          <img src="/logo.png" alt="One Bite" className={styles.brandLogoImg} />
        </Link>

        <div className={`${styles.nav} ${mobileOpen ? styles.open : ''}`}>
          <Link href="/" className={styles.navLink} onClick={() => setMobileOpen(false)}>Home</Link>
          <Link href="/#menu" className={styles.navLink} onClick={handleMenuClick}>Menu</Link>
          <Link href="/orders" className={styles.navLink} onClick={() => setMobileOpen(false)}>My Orders</Link>
          <Link href="/cart" className={`${styles.navLink} ${styles.mobileOnlyLink}`} onClick={() => setMobileOpen(false)}>
            Cart {totalQuantity > 0 ? `(${totalQuantity})` : ''}
          </Link>

          {isAuthenticated && user?.role === 'customer' && (
            <Link href="/profile" className={`${styles.navLink} ${styles.mobileOnlyLink}`} onClick={() => setMobileOpen(false)}>
              Profile
            </Link>
          )}

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
          <Link href="/cart" className={styles.cartBtn} aria-label="Cart">
            🛒
            {totalQuantity > 0 && (
              <span className={styles.badge}>{totalQuantity}</span>
            )}
          </Link>
          
          {isAuthenticated ? (
            user?.role === 'customer' ? (
              <Link href="/profile" className={styles.loginBtn}>Profile</Link>
            ) : (
              <Link href="/staff/dashboard" className={styles.loginBtn}>Dashboard</Link>
            )
          ) : (
            <Link href="/login" className={styles.loginBtn}>Sign In</Link>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)}></div>
      )}
    </nav>
  );
}
