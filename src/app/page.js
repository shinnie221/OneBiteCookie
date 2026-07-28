'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar/Navbar';
import Footer from '@/components/Footer/Footer';
import ProductCard from '@/components/ProductCard/ProductCard';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>🍪 Freshly Baked Daily</div>
          <h1 className={styles.heroTitle}>
            Every cookie tells a story.<br />
            <span className={styles.heroAccent}>One Bite</span> is all it takes.
          </h1>
          <p className={styles.heroSubtitle}>
            Handcrafted premium cookies made with the finest ingredients.
            Order online and pick up or get them delivered to your door.
          </p>
          <a href="#menu" className={styles.heroCta}>
            Explore Our Menu ↓
          </a>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.floatingCookie} style={{ animationDelay: '0s' }}>🍪</div>
          <div className={styles.floatingCookie} style={{ animationDelay: '1s' }}>🍪</div>
          <div className={styles.floatingCookie} style={{ animationDelay: '2s' }}>🍪</div>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>🧑‍🍳</span>
          <h3>Handcrafted</h3>
          <p>Every cookie is made from scratch with love and care</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>🌿</span>
          <h3>Premium Ingredients</h3>
          <p>Only the finest butter, chocolate, and natural flavors</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>📦</span>
          <h3>Fresh Delivery</h3>
          <p>Baked fresh and delivered straight to your doorstep</p>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className={styles.menu}>
        <div className={styles.menuHeader}>
          <h2 className={styles.sectionTitle}>Our Cookies</h2>
          <p className={styles.sectionSubtitle}>Choose your favorites and build your perfect cookie box</p>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading our fresh cookies..." />
        ) : products.length === 0 ? (
          <p className={styles.emptyMenu}>No cookies available right now. Check back soon!</p>
        ) : (
          <div className={styles.productGrid}>
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>How It Works</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <h3>Pick Your Cookies</h3>
            <p>Browse our menu and add your favorites to the cart</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <h3>Checkout</h3>
            <p>Fill in your details and review your order</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <h3>Pay via QR</h3>
            <p>Scan our QR code and upload payment proof</p>
          </div>
          <div className={styles.stepArrow}>→</div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>4</div>
            <h3>Enjoy!</h3>
            <p>Pick up or receive your cookies fresh and warm</p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
