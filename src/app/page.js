'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import ProductCard from '@/components/ProductCard/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import Footer from '@/components/Footer/Footer';
import { DEFAULT_BANNER, DEFAULT_AVATAR } from '@/lib/storefrontDefaults';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const { totalQuantity, total } = useCart();
  const { isAuthenticated, user, logout } = useAuth();

  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({
    banner_image: '',
    avatar_image: '',
    store_name: 'Bakery Sora',
    store_bio: 'Everything baked goods 🤎',
    currency_symbol: 'RM',
    cart_button_label: 'View Cart',
  });
  const [loading, setLoading] = useState(true);

  // UI States
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetch('/api/products').then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
      fetch('/api/settings').then(r => r.ok ? r.json() : { settings: {} }).catch(() => ({ settings: {} }))
    ]).then(([prodData, settData]) => {
      if (!isMounted) return;

      if (prodData?.products) {
        setProducts(prodData.products);
      }

      if (settData?.settings) {
        setSettings(prev => ({
          ...prev,
          banner_image: settData.settings.banner_image || '',
          avatar_image: settData.settings.avatar_image || '',
          store_name: settData.settings.store_name || 'Bakery Sora',
          store_bio: settData.settings.store_bio || 'Everything baked goods 🤎',
          currency_symbol: settData.settings.currency_symbol || 'RM',
          cart_button_label: settData.settings.cart_button_label && settData.settings.cart_button_label !== '购物车'
            ? settData.settings.cart_button_label
            : 'View Cart',
        }));
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, searchQuery]);

  // Separate BYOB products and Cookies products
  const byobProducts = useMemo(() => {
    return filteredProducts.filter(p => p.is_byob);
  }, [filteredProducts]);

  const cookieProducts = useMemo(() => {
    return filteredProducts.filter(p => !p.is_byob);
  }, [filteredProducts]);

  const isStaffUser = isAuthenticated && user && user.role !== 'customer';
  const currencySymbol = settings.currency_symbol || '₱';

  const scrollToMenu = (e) => {
    if (e) e.preventDefault();
    const menuEl = document.getElementById('menu');
    if (menuEl) {
      menuEl.scrollIntoView({ behavior: 'smooth' });
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', '#menu');
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#menu') {
      const timer = setTimeout(() => {
        const menuEl = document.getElementById('menu');
        if (menuEl) {
          menuEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className={styles.storefrontWrapper}>
      {/* 1. Quick Staff Toolbar (visible to store owner / staff) */}
      {isStaffUser && (
        <div className={styles.staffQuickBar}>
          <span>👋 Admin Mode Active</span>
          <Link href="/staff/storefront" className={styles.staffQuickBtn}>
            🎨 Storefront Settings
          </Link>
        </div>
      )}

      {/* 2. Top Navigation Bar (Adaptive Mobile & Laptop) */}
      <header className={styles.topNav}>
        <div className={styles.navLeft}>
          <button
            type="button"
            className={`${styles.navIconButton} ${styles.mobileOnly}`}
            onClick={() => setMenuDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            ☰
          </button>

          <Link href="/" className={styles.desktopBrand}>
            <span>🍪</span>
            <span>{settings.store_name || 'Bakery Sora'}</span>
          </Link>
        </div>

        {/* Mobile Center Title */}
        <div className={`${styles.navCenterTitle} ${styles.mobileOnly}`}>
          {settings.store_name || 'Bakery Sora'}
        </div>

        {/* Desktop Nav Links */}
        <nav className={styles.desktopNavLinks}>
          <Link href="/" className={styles.desktopNavLink}>Home</Link>
          <a href="#menu" className={styles.desktopNavLink} onClick={scrollToMenu}>Menu</a>
          <Link href="/orders" className={styles.desktopNavLink}>My Orders</Link>
          {isStaffUser && (
            <Link href="/staff/dashboard" className={styles.desktopNavLink}>Staff Dashboard</Link>
          )}
        </nav>

        {/* Right Actions */}
        <div className={styles.navActions}>
          <button
            type="button"
            className={styles.navIconButton}
            onClick={() => setSearchOpen(prev => !prev)}
            aria-label="Toggle search bar"
          >
            🔍
          </button>

          <Link href="/cart" className={styles.cartBagButton} aria-label="View Cart">
            🛒
            {totalQuantity > 0 && (
              <span className={styles.cartCountBadge}>{totalQuantity}</span>
            )}
          </Link>

          {isAuthenticated ? (
            user?.role === 'customer' ? (
              <Link href="/profile" className={styles.desktopAuthBtn}>
                Profile
              </Link>
            ) : (
              <Link href="/staff/dashboard" className={styles.desktopAuthBtn}>
                ⚙️ Dashboard
              </Link>
            )
          ) : (
            <Link href="/login" className={styles.desktopAuthBtn}>
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* 3. Search Bar Dropdown */}
      {searchOpen && (
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search cookies by flavor or ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.searchClearBtn}
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Hero Banner Card */}
      <section className={styles.heroContainer}>
        <div className={styles.heroBannerCard}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settings.banner_image || DEFAULT_BANNER}
            alt="Bakery Banner"
            className={styles.heroBannerImg}
          />
        </div>

        {/* Circular Avatar / Logo overlapping banner */}
        <div className={styles.avatarWrapper}>
          <div className={styles.avatarCircle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={settings.avatar_image || DEFAULT_AVATAR}
              alt="Bakery Avatar Logo"
              className={styles.avatarImg}
            />
          </div>
        </div>
      </section>

      {/* 5. Store Information */}
      <section className={styles.storeInfo}>
        <h1 className={styles.storeTitle}>
          {settings.store_name || 'Bakery Sora'}
        </h1>
      </section>

      {/* 6. Bio / Slogan Card */}
      <div className={styles.bioCard}>
        {settings.store_bio || 'Everything baked goods 🤎'}
      </div>

      {/* 7. Cookies Section */}
      <section className={styles.menuSection} id="menu" style={{ paddingBottom: '32px' }}>
        <div className={styles.categoryHeader}>
          <div className={styles.categoryHeaderLeft}>
            <h2 className={styles.categoryTitle}>🍪 Cookies</h2>
            <span className={styles.categoryBadge}>Single Flavors</span>
          </div>
          <span className={styles.categoryCount}>
            {cookieProducts.length} {cookieProducts.length === 1 ? 'flavor' : 'flavors'}
          </span>
        </div>
        <p className={styles.categorySubtitle}>
          Handcrafted signature cookies available per piece or in same-flavor boxes.
        </p>

        {loading ? (
          <LoadingSpinner text="Loading freshly baked cookies..." />
        ) : cookieProducts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🍪</div>
            <p>
              {searchQuery
                ? `No cookies found matching "${searchQuery}"`
                : 'No cookies available at the moment. Please check back later!'}
            </p>
          </div>
        ) : (
          <div className={styles.productList}>
            {cookieProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                currencySymbol={currencySymbol}
                allProducts={products}
              />
            ))}
          </div>
        )}
      </section>

      {/* 8. Build Your Own Box (BYOB) Section (Below Cookies) */}
      {byobProducts.length > 0 && (
        <section className={styles.menuSection} id="byob">
          <div className={styles.categoryHeader}>
            <div className={styles.categoryHeaderLeft}>
              <h2 className={styles.categoryTitle}>Build Your Own Box</h2>
              <span className={styles.categoryBadge}>Custom Box</span>
            </div>
            <span className={styles.categoryCount}>
              {byobProducts.length} {byobProducts.length === 1 ? 'option' : 'options'}
            </span>
          </div>
          <p className={styles.categorySubtitle}>
            Mix and match your favorite flavors in boxes.
          </p>

          <div className={styles.productList}>
            {byobProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                currencySymbol={currencySymbol}
                allProducts={products}
              />
            ))}
          </div>
        </section>
      )}

      {/* 9. Floating Bottom Sticky Cart Bar */}
      {totalQuantity > 0 && (
        <div className={styles.floatingCartContainer}>
          <Link href="/cart" className={styles.floatingCartBar}>
            <div className={styles.cartQtyCircle}>{totalQuantity}</div>
            <div className={styles.cartBarLabel}>
              {settings.cart_button_label || 'View Cart'}
            </div>
            <div className={styles.cartBarPrice}>
              {currencySymbol}{total.toFixed(2)}
            </div>
          </Link>
        </div>
      )}

      {/* 10. Slide-out Navigation Drawer Menu */}
      {menuDrawerOpen && (
        <>
          <div
            className={styles.drawerOverlay}
            onClick={() => setMenuDrawerOpen(false)}
          />
          <aside className={styles.drawerMenu}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>
                {settings.store_name || 'Bakery Sora'}
              </span>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={() => setMenuDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerLinks}>
              <Link
                href="/"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                🏠 Home
              </Link>
              <a
                href="#menu"
                className={styles.drawerLink}
                onClick={(e) => {
                  setMenuDrawerOpen(false);
                  scrollToMenu(e);
                }}
              >
                🍪 Menu
              </a>
              <Link
                href="/orders"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                📦 My Orders
              </Link>
              <Link
                href="/cart"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                🛒 Cart ({totalQuantity})
              </Link>

              {isAuthenticated && user?.role === 'customer' && (
                <Link
                  href="/profile"
                  className={styles.drawerLink}
                  onClick={() => setMenuDrawerOpen(false)}
                >
                  Profile
                </Link>
              )}

              {isStaffUser && (
                <>
                  <Link
                    href="/staff/dashboard"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    📊 Staff Dashboard
                  </Link>
                  <Link
                    href="/staff/storefront"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    🎨 Storefront Settings
                  </Link>
                  <Link
                    href="/staff/products"
                    className={styles.drawerLink}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    🍪 Products Management
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
                    setMenuDrawerOpen(false);
                    logout();
                    router.push('/');
                  }}
                >
                  Log Out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="btn btnPrimary"
                  style={{ display: 'block', textAlign: 'center' }}
                  onClick={() => setMenuDrawerOpen(false)}
                >
                  Sign In / Register
                </Link>
              )}
            </div>
          </aside>
        </>
      )}

      {/* 11. Footer (Home Page Only) */}
      <Footer />
    </div>
  );
}
