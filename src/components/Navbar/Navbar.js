'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ShoppingCart,
  Home,
  Cookie,
  Package,
  User,
  LayoutDashboard,
  Palette
} from 'lucide-react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { totalQuantity } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isStaffUser = isAuthenticated && user && user.role !== 'customer';

  // Prevent background scrolling while drawer is open
  useEffect(() => {
    if (mobileOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [mobileOpen]);

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
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          <Link href="/" className={styles.desktopLogo}>
            <img src="/logo.png" alt="One Bite" className={styles.brandLogoImg} />
          </Link>
        </div>

        {/* Mobile Center Title (Matches Home & Menu Header) */}
        <Link href="/" className={styles.mobileCenterTitle}>
          <img src="/logo.png" alt="One Bite" className={styles.brandLogoImg} />
        </Link>

        {/* Desktop Nav Links */}
        <div className={styles.nav}>
          <Link href="/" className={`${styles.navLink} ${pathname === '/' ? styles.navLinkActive : ''}`}>Home</Link>
          <Link href="/#menu" className={styles.navLink} onClick={handleMenuClick}>Menu</Link>
          <Link href="/orders" className={`${styles.navLink} ${pathname === '/orders' ? styles.navLinkActive : ''}`}>My Orders</Link>

          {isStaffUser && (
            <Link href="/staff/dashboard" className={styles.navLink}>Staff Dashboard</Link>
          )}
        </div>

        {/* Right Actions */}
        <div className={styles.actions}>
          <Link href="/cart" className={styles.cartBtn} aria-label="Cart">
            <ShoppingCart size={20} />
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

      {/* Slide-out Navigation Drawer Menu (Matching Home & Menu Drawer) */}
      {mobileOpen && (
        <>
          <div
            className={styles.drawerOverlay}
            onClick={() => setMobileOpen(false)}
          />
          <aside className={styles.drawerMenu}>
            <div className={styles.drawerHeader}>
              <Link href="/" onClick={() => setMobileOpen(false)}>
                <img src="/logo.png" alt="One Bite" className={styles.drawerLogoImg} />
              </Link>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.drawerLinks}>
              <Link
                href="/"
                className={`${styles.drawerLink} ${pathname === '/' ? styles.drawerLinkActive : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Home size={18} /> Home
              </Link>
              <Link
                href="/#menu"
                className={styles.drawerLink}
                onClick={handleMenuClick}
              >
                <Cookie size={18} /> Menu
              </Link>
              <Link
                href="/orders"
                className={`${styles.drawerLink} ${pathname === '/orders' ? styles.drawerLinkActive : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <Package size={18} /> My Orders
              </Link>
              <Link
                href="/cart"
                className={`${styles.drawerLink} ${pathname === '/cart' ? styles.drawerLinkActive : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <ShoppingCart size={18} /> Cart ({totalQuantity})
              </Link>

              {isAuthenticated && user?.role === 'customer' && (
                <Link
                  href="/profile"
                  className={`${styles.drawerLink} ${pathname === '/profile' ? styles.drawerLinkActive : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <User size={18} /> Profile
                </Link>
              )}

              {isStaffUser && (
                <>
                  <Link
                    href="/staff/dashboard"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <LayoutDashboard size={18} /> Staff Dashboard
                  </Link>
                  <Link
                    href="/staff/storefront"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Palette size={18} /> Storefront Settings
                  </Link>
                  <Link
                    href="/staff/products"
                    className={styles.drawerLink}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Cookie size={18} /> Products Management
                  </Link>
                </>
              )}
            </div>

            <div className={styles.drawerFooter}>
              {isAuthenticated ? (
                <button
                  type="button"
                  className={styles.drawerLogoutBtn}
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  Log Out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="btn btnPrimary"
                  style={{ display: 'block', textAlign: 'center' }}
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In / Register
                </Link>
              )}
            </div>
          </aside>
        </>
      )}
    </nav>
  );
}
