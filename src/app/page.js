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
    cart_button_label: '购物车',
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
          cart_button_label: settData.settings.cart_button_label || '购物车',
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

  // Filter and sort products (BYOB box at top)
  const filteredProducts = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    // Place BYOB item at the very top of menu
    return [...list].sort((a, b) => (b.is_byob ? 1 : 0) - (a.is_byob ? 1 : 0));
  }, [products, searchQuery]);

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
          <span>👋 管理员模式已开启</span>
          <Link href="/staff/storefront" className={styles.staffQuickBtn}>
            🎨 更换店铺外观与图片
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
            🛍️
            {totalQuantity > 0 && (
              <span className={styles.cartCountBadge}>{totalQuantity}</span>
            )}
          </Link>

          {isAuthenticated ? (
            user?.role === 'customer' ? (
              <Link href="/profile" className={styles.desktopAuthBtn}>
                👤 Profile
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

      {/* 7. Product Menu Section */}
      <section className={styles.menuSection} id="menu">
        <div className={styles.categoryHeader}>
          <h2 className={styles.categoryTitle}>Cookies</h2>
          <span className={styles.categoryCount}>
            {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading freshly baked cookies..." />
        ) : filteredProducts.length === 0 ? (
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
            {filteredProducts.map(product => (
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

      {/* 8. Floating Bottom Sticky Cart Bar */}
      {totalQuantity > 0 && (
        <div className={styles.floatingCartContainer}>
          <Link href="/cart" className={styles.floatingCartBar}>
            <div className={styles.cartQtyCircle}>{totalQuantity}</div>
            <div className={styles.cartBarLabel}>
              {settings.cart_button_label || '购物车'}
            </div>
            <div className={styles.cartBarPrice}>
              {currencySymbol}{total.toFixed(2)}
            </div>
          </Link>
        </div>
      )}

      {/* 9. Slide-out Navigation Drawer Menu */}
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
                🏠 Home / 首页
              </Link>
              <a
                href="#menu"
                className={styles.drawerLink}
                onClick={(e) => {
                  setMenuDrawerOpen(false);
                  scrollToMenu(e);
                }}
              >
                🍪 Menu / 菜单
              </a>
              <Link
                href="/orders"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                📦 My Orders / 历史订单
              </Link>
              <Link
                href="/cart"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                🛒 Cart / 购物车 ({totalQuantity})
              </Link>

              {isAuthenticated && user?.role === 'customer' && (
                <Link
                  href="/profile"
                  className={styles.drawerLink}
                  onClick={() => setMenuDrawerOpen(false)}
                >
                  👤 Profile / 个人资料
                </Link>
              )}

              {isStaffUser && (
                <>
                  <Link
                    href="/staff/dashboard"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    📊 Staff Dashboard / 管理后台
                  </Link>
                  <Link
                    href="/staff/storefront"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    🎨 更换店铺外观与图片
                  </Link>
                  <Link
                    href="/staff/products"
                    className={styles.drawerLink}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    🍪 曲奇商品及图片管理
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
                  Log Out / 退出登录
                </button>
              ) : (
                <Link
                  href="/login"
                  className="btn btnPrimary"
                  style={{ display: 'block', textAlign: 'center' }}
                  onClick={() => setMenuDrawerOpen(false)}
                >
                  Sign In / 登录或注册
                </Link>
              )}
            </div>
          </aside>
        </>
      )}

      {/* 10. Footer (Home Page Only) */}
      <Footer />
    </div>
  );
}
