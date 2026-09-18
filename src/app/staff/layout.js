'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './layout.module.css';

const NAV_GROUPS = [
  {
    label: '业务概览', items: [
      { path: '/staff/dashboard', label: '业务总览', icon: '◷' },
      { path: '/staff/ledger', label: '总结流水账本', icon: '📒' },
      { path: '/staff/expenses', label: '成本支出', icon: '🏷️' },
    ]
  },
  {
    label: '销售渠道', items: [
      { path: '/staff/orders', label: '线上预购', icon: '▤' },
      { path: '/staff/booth', label: '摆摊销售', icon: '⌂' },
      { path: '/staff/wholesale', label: '批发供货', icon: '▥' },
    ]
  },
  {
    label: '店铺管理', items: [
      { path: '/staff/products', label: '曲奇菜单', icon: '◇' },
      { path: '/staff/settings', label: '系统设置', icon: '⚙' },
    ]
  },
];

export default function StaffLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const activePath = ['/staff/qr-payment', '/staff/vouchers', '/staff/customers'].includes(pathname) ? '/staff/settings' : pathname;
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
        <LoadingSpinner text="正在验证身份..." />
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
          <span className={styles.logoText}>员工后台</span>
        </div>
        <button aria-label="打开员工菜单" aria-expanded={mobileOpen} aria-controls="staff-navigation" className={styles.menuBtn} onClick={() => setMobileOpen(!mobileOpen)}>
          ☰
        </button>
      </div>

      {/* Sidebar */}
      <aside id="staff-navigation" className={`${styles.sidebar} ${mobileOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <button className={styles.closeMenu} onClick={() => setMobileOpen(false)} aria-label="关闭员工菜单">✕</button>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🍪</span>
            <span className={styles.logoText}>One Bite</span>
          </div>
          <div className={styles.staffInfo}>
            <div className={styles.avatar}>{user?.name?.charAt(0) || 'S'}</div>
            <div>
              <div className={styles.staffName}>{user?.name || '员工'}</div>
              <div className={styles.staffRole}>{user?.role === 'admin' ? '超级管理员' : '员工'}</div>
            </div>
          </div>
        </div>

        <nav className={styles.nav} aria-label="员工菜单导航">
          {NAV_GROUPS.map(group => (
            <div className={styles.navGroup} key={group.label}>
              <p className={styles.groupLabel}>{group.label}</p>
              {group.items.map(item => (
                <Link key={item.path} href={item.path}
                  aria-current={activePath === item.path ? 'page' : undefined}
                  className={`${styles.navItem} ${activePath === item.path ? styles.active : ''}`}
                  onClick={() => setMobileOpen(false)}>
                  <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={`${styles.navItem} ${styles.logoutBtn}`} onClick={handleLogout}>
            <span className={styles.navIcon}>🚪</span>
            退出登录
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
