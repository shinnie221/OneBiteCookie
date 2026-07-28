import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <span>🍪</span>
              <span className={styles.logoText}>One Bite</span>
            </div>
            <p className={styles.tagline}>Handcrafted cookies, baked with love.<br/>Every bite tells a story.</p>
          </div>

          <div className={styles.links}>
            <h4>Quick Links</h4>
            <Link href="/">Home</Link>
            <Link href="/#menu">Our Menu</Link>
            <Link href="/track">Track Order</Link>
            <Link href="/login">Staff Login</Link>
          </div>

          <div className={styles.contact}>
            <h4>Contact Us</h4>
            <p>📍 123 Cookie Lane, Kuala Lumpur</p>
            <p>📞 012-345-6789</p>
            <p>✉️ hello@onebite.com</p>
            <p>🕐 Mon-Sat: 9AM - 8PM</p>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} One Bite Cookie Shop. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
