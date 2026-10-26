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
import {
  getCachedItem,
  setCachedItem,
  CACHE_KEYS,
  preloadImageUrls,
  registerServiceWorker
} from '@/lib/clientCache';
import {
  Menu,
  X,
  Search,
  ShoppingCart,
  LayoutDashboard,
  Cookie,
  Home,
  Package,
  User,
  Palette,
  ShieldCheck
} from 'lucide-react';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const { totalQuantity, total } = useCart();
  const { isAuthenticated, user, logout } = useAuth();

  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({
    banner_image: '',
    avatar_image: '',
    store_name: 'One Bite',
    store_bio: 'Everything baked goods',
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

    // Register service worker for image caching
    registerServiceWorker();

    // 1. Instantly restore cached products & settings if available (0ms loading time)
    const cachedProducts = getCachedItem(CACHE_KEYS.PRODUCTS);
    const cachedSettings = getCachedItem(CACHE_KEYS.SETTINGS);

    if (cachedProducts && Array.isArray(cachedProducts) && cachedProducts.length > 0) {
      setProducts(cachedProducts);
      setLoading(false);
    }

    if (cachedSettings) {
      setSettings(prev => ({
        ...prev,
        banner_image: cachedSettings.banner_image || prev.banner_image,
        avatar_image: cachedSettings.avatar_image || prev.avatar_image,
        store_name: cachedSettings.store_name || prev.store_name,
        store_bio: cachedSettings.store_bio || prev.store_bio,
        currency_symbol: cachedSettings.currency_symbol || prev.currency_symbol,
        cart_button_label: cachedSettings.cart_button_label && cachedSettings.cart_button_label !== '购物车'
          ? cachedSettings.cart_button_label
          : prev.cart_button_label,
      }));
    }

    // 2. Fetch fresh data in the background (Stale-While-Revalidate)
    Promise.all([
      fetch('/api/products').then(r => r.ok ? r.json() : { products: [] }).catch(() => ({ products: [] })),
      fetch('/api/settings').then(r => r.ok ? r.json() : { settings: {} }).catch(() => ({ settings: {} }))
    ]).then(([prodData, settData]) => {
      if (!isMounted) return;

      if (prodData?.products) {
        setProducts(prodData.products);
        setCachedItem(CACHE_KEYS.PRODUCTS, prodData.products);
      }

      if (settData?.settings) {
        setSettings(prev => ({
          ...prev,
          banner_image: settData.settings.banner_image || '',
          avatar_image: settData.settings.avatar_image || '',
          store_name: settData.settings.store_name || 'One Bite',
          store_bio: settData.settings.store_bio || 'Everything baked goods',
          currency_symbol: settData.settings.currency_symbol || 'RM',
          cart_button_label: settData.settings.cart_button_label && settData.settings.cart_button_label !== '购物车'
            ? settData.settings.cart_button_label
            : 'View Cart',
        }));
        setCachedItem(CACHE_KEYS.SETTINGS, settData.settings);
      }

      // Preload all product photos and brand banners into browser & service worker cache
      const imagesToPreload = [];
      if (settData?.settings?.banner_image) imagesToPreload.push(settData.settings.banner_image);
      if (settData?.settings?.avatar_image) imagesToPreload.push(settData.settings.avatar_image);
      if (prodData?.products) {
        prodData.products.forEach(p => {
          if (Array.isArray(p.images)) imagesToPreload.push(...p.images);
          if (p.image) imagesToPreload.push(p.image);
        });
      }
      preloadImageUrls(imagesToPreload);

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
  const currencySymbol = settings.currency_symbol || 'RM';
  const storeLocation = settings.pickup_address?.split(',')?.pop()?.trim() || settings.city || 'W.P. Kuala Lumpur';

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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> Admin Mode Active
          </span>
          <Link href="/staff/storefront" className={styles.staffQuickBtn} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Palette size={15} /> Storefront Settings
          </Link>
        </div>
      )}

      {/* 2. Top Navigation Bar (Adaptive Mobile & Laptop) */}
      <header className={styles.topNav}>
        <div className={styles.topNavInner}>
          <div className={styles.navLeft}>
            <button
              type="button"
              className={`${styles.navIconButton} ${styles.mobileOnly}`}
              onClick={() => setMenuDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            <Link href="/" className={styles.desktopBrand}>
              <img src="/logo.png" alt="One Bite" className={styles.brandLogoImg} />
            </Link>
          </div>

          {/* Mobile Center Title */}
          <Link href="/" className={`${styles.navCenterTitle} ${styles.mobileOnly}`}>
            <img src="/logo.png" alt="One Bite" className={styles.brandLogoImg} />
          </Link>

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
              <Search size={19} />
            </button>

            <Link href="/cart" className={styles.cartBagButton} aria-label="View Cart">
              <ShoppingCart size={19} />
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
                <Link href="/staff/dashboard" className={styles.desktopAuthBtn} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <LayoutDashboard size={15} /> Dashboard
                </Link>
              )
            ) : (
              <Link href="/login" className={styles.desktopAuthBtn}>
                Sign In
              </Link>
            )}
          </div>
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
                aria-label="Clear search"
              >
                <X size={16} />
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
            loading="eager"
            fetchPriority="high"
            decoding="async"
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
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
      </section>

      {/* 5. Store Information */}
      <section className={styles.storeInfo}>
        <h1 className={styles.storeTitle}>
          {settings.store_name || 'One Bite'}
        </h1>
      </section>

      {/* 6. Bio / Slogan Card */}
      <div className={styles.bioCard}>
        {settings.store_bio
          ? String(settings.store_bio).replace(/\\n/g, '\n')
          : 'Everything baked goods'}
      </div>

      {/* 7. Cookies Section */}
      <section className={styles.menuSection} id="menu" style={{ paddingBottom: '32px' }}>
        <div className={styles.categoryHeader}>
          <div className={styles.categoryHeaderLeft}>
            <h2 className={styles.categoryTitle}>Cookies</h2>
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
            <div className={styles.emptyIcon}>
              <Cookie size={46} strokeWidth={1.5} />
            </div>
            <p>
              {searchQuery
                ? `No cookies found matching "${searchQuery}"`
                : 'No cookies available at the moment. Please check back later!'}
            </p>
          </div>
        ) : (
          <div className={styles.productList}>
            {cookieProducts.map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                currencySymbol={currencySymbol}
                allProducts={products}
                location={storeLocation}
                priority={idx < 4}
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
            {byobProducts.map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                currencySymbol={currencySymbol}
                allProducts={products}
                location={storeLocation}
                priority={idx < 2}
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
              <Link href="/" onClick={() => setMenuDrawerOpen(false)}>
                <img src="/logo.png" alt="One Bite" className={styles.drawerLogoImg} />
              </Link>
              <button
                type="button"
                className={styles.drawerCloseBtn}
                onClick={() => setMenuDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.drawerLinks}>
              <Link
                href="/"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                <Home size={18} /> Home
              </Link>
              <a
                href="#menu"
                className={styles.drawerLink}
                onClick={(e) => {
                  setMenuDrawerOpen(false);
                  scrollToMenu(e);
                }}
              >
                <Cookie size={18} /> Menu
              </a>
              <Link
                href="/orders"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                <Package size={18} /> My Orders
              </Link>
              <Link
                href="/cart"
                className={styles.drawerLink}
                onClick={() => setMenuDrawerOpen(false)}
              >
                <ShoppingCart size={18} /> Cart ({totalQuantity})
              </Link>

              {isAuthenticated && user?.role === 'customer' && (
                <Link
                  href="/profile"
                  className={styles.drawerLink}
                  onClick={() => setMenuDrawerOpen(false)}
                >
                  <User size={18} /> Profile
                </Link>
              )}

              {isStaffUser && (
                <>
                  <Link
                    href="/staff/dashboard"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    <LayoutDashboard size={18} /> Staff Dashboard
                  </Link>
                  <Link
                    href="/staff/storefront"
                    className={`${styles.drawerLink} ${styles.drawerHighlight}`}
                    onClick={() => setMenuDrawerOpen(false)}
                  >
                    <Palette size={18} /> Storefront Settings
                  </Link>
                  <Link
                    href="/staff/products"
                    className={styles.drawerLink}
                    onClick={() => setMenuDrawerOpen(false)}
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
