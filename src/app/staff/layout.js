'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './layout.module.css';

const NAV_ITEMS = [
  { path: '/staff/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/staff/orders', label: 'Orders', icon: '🛍️' },
  { path: '/staff/products', label: 'Products & Stock', icon: '🍪' },
  { path: '/staff/customers', label: 'Customers', icon: '👥' },
  { path: '/staff/vouchers', label: 'Vouchers', icon: '🎟️' },
  { path: '/staff/qr-payment', label: 'QR Payment', icon: '📱' },
  { path: '/staff/sales', label: 'Sales History', icon: '📈' },
];

export default function StaffLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading, logout, user } = useAuth();
  
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user?.role === 'customer') {
        router.replace('/');
      }
    }
  }, [loading, isAuthenticated, user, router]);

  if (loading || !isAuthenticated || user?.role === 'customer') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Checking authentication..." />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🍪</span>
          <span className={styles.logoText}>Staff Portal</span>
        </div>
        <button className={styles.menuBtn} onClick={() => setMobileOpen(!mobileOpen)}>
          ☰
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🍪</span>
            <span className={styles.logoText}>One Bite</span>
          </div>
          <div className={styles.staffInfo}>
            <div className={styles.avatar}>{user?.name?.charAt(0) || 'S'}</div>
            <div>
              <div className={styles.staffName}>{user?.name || 'Staff'}</div>
              <div className={styles.staffRole}>{user?.role === 'admin' ? 'Administrator' : 'Staff'}</div>
            </div>
          </div>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <Link 
              key={item.path} 
              href={item.path}
              className={`${styles.navItem} ${pathname === item.path ? styles.active : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <a href="/" target="_blank" className={styles.navItem}>
            <span className={styles.navIcon}>🌐</span>
            View Store
          </a>
          <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout}>
            <span className={styles.navIcon}>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)}></div>
      )}

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}
