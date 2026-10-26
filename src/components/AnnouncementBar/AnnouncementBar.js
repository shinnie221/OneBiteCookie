'use client';

import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Megaphone, ChevronRight } from 'lucide-react';
import { getCachedItem, setCachedItem, CACHE_KEYS } from '@/lib/clientCache';
import styles from './AnnouncementBar.module.css';

// Fired by the storefront settings page after saving so the bar updates without a reload
export const ANNOUNCEMENT_UPDATED_EVENT = 'onebite:announcement-updated';

// Pages where the customer-facing bar should not appear
const HIDDEN_PREFIXES = ['/staff', '/login'];

// Only allow http(s) URLs or same-site paths (blocks javascript: and protocol-relative links)
export function sanitizeAnnouncementLink(link) {
  const value = (link || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  return '';
}

export function AnnouncementStrip({ text, link, compact = false }) {
  const safeLink = sanitizeAnnouncementLink(link);
  const isExternal = /^https?:\/\//i.test(safeLink);

  const content = (
    <>
      <Megaphone size={compact ? 12 : 15} className={styles.icon} aria-hidden="true" />
      <span className={styles.text}>{text}</span>
      {safeLink && <ChevronRight size={compact ? 12 : 15} className={styles.chevron} aria-hidden="true" />}
    </>
  );

  return (
    <div className={`${styles.bar} ${compact ? styles.compact : ''}`} role="region" aria-label="Store announcement">
      {safeLink ? (
        isExternal ? (
          <a href={safeLink} target="_blank" rel="noopener noreferrer" className={styles.inner}>{content}</a>
        ) : (
          <Link href={safeLink} className={styles.inner}>{content}</Link>
        )
      ) : (
        <div className={styles.inner}>{content}</div>
      )}
    </div>
  );
}

// Tiny client store backed by localStorage: the last known announcement paints
// instantly after hydration, then gets revalidated from the API.
let currentAnnouncement = null;
let cacheLoaded = false;
const listeners = new Set();

function getSnapshot() {
  if (!cacheLoaded) {
    cacheLoaded = true;
    currentAnnouncement = getCachedItem(CACHE_KEYS.ANNOUNCEMENT);
  }
  return currentAnnouncement;
}

function getServerSnapshot() {
  return null;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setAnnouncement(announcement) {
  currentAnnouncement = announcement;
  cacheLoaded = true;
  setCachedItem(CACHE_KEYS.ANNOUNCEMENT, announcement);
  listeners.forEach(listener => listener());
}

function refreshAnnouncement() {
  fetch('/api/announcement')
    .then(res => (res.ok ? res.json() : null))
    .then(data => {
      if (data?.announcement) setAnnouncement(data.announcement);
    })
    .catch(() => {});
}

export default function AnnouncementBar() {
  const pathname = usePathname();
  const announcement = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    refreshAnnouncement();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshAnnouncement();
    };
    const handleUpdated = (e) => {
      if (e.detail) setAnnouncement(e.detail);
      else refreshAnnouncement();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(ANNOUNCEMENT_UPDATED_EVENT, handleUpdated);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(ANNOUNCEMENT_UPDATED_EVENT, handleUpdated);
    };
  }, []);

  const isHidden = HIDDEN_PREFIXES.some(prefix => pathname?.startsWith(prefix));
  if (isHidden || !announcement?.enabled || !announcement.text?.trim()) return null;

  return <AnnouncementStrip text={announcement.text} link={announcement.link} />;
}
