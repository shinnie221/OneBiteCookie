'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { uploadImageToImgBB } from '@/lib/imgbb';
import {
  DEFAULT_BANNER,
  DEFAULT_AVATAR,
  PRESET_BANNERS,
  PRESET_AVATARS
} from '@/lib/storefrontDefaults';
import styles from './page.module.css';

export default function StorefrontSettingsPage() {
  const { authFetch } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const bannerFileRef = useRef(null);
  const avatarFileRef = useRef(null);

  const [formData, setFormData] = useState({
    banner_image: '',
    avatar_image: '',
    store_name: 'Bakery Sora',
    store_bio: 'Everything baked goods 🤎',
    store_rating: '5 (2)',
    currency_symbol: 'RM',
    cart_button_label: '购物车',
  });

  useEffect(() => {
    let isMounted = true;

    authFetch('/api/settings')
      .then(res => res.ok ? res.json() : { settings: {} })
      .then(data => {
        if (!isMounted) return;
        if (data?.settings) {
          setFormData(prev => ({
            ...prev,
            banner_image: data.settings.banner_image || '',
            avatar_image: data.settings.avatar_image || '',
            store_name: data.settings.store_name || 'Bakery Sora',
            store_bio: data.settings.store_bio || 'Everything baked goods 🤎',
            currency_symbol: data.settings.currency_symbol || 'RM',
            cart_button_label: data.settings.cart_button_label || '购物车',
          }));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        toast.error('无法加载店铺设置');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authFetch, toast]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Upload or replace banner file
  const handleBannerFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error('图片大小不能超过 8MB');
      return;
    }

    setUploadingBanner(true);
    try {
      let finalUrl = '';
      try {
        finalUrl = await uploadImageToImgBB(file);
      } catch {
        // Fallback to local Data URL
        finalUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        });
      }

      setFormData(prev => ({ ...prev, banner_image: finalUrl }));
      toast.success('横幅图片已选取并更新预览');
    } catch {
      toast.error('上传图片时出错');
    } finally {
      setUploadingBanner(false);
      if (bannerFileRef.current) bannerFileRef.current.value = '';
    }
  };

  // Upload or replace avatar file
  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error('图片大小不能超过 8MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      let finalUrl = '';
      try {
        finalUrl = await uploadImageToImgBB(file);
      } catch {
        // Fallback to local Data URL
        finalUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        });
      }

      setFormData(prev => ({ ...prev, avatar_image: finalUrl }));
      toast.success('头像/Logo已选取并更新预览');
    } catch {
      toast.error('上传图片时出错');
    } finally {
      setUploadingAvatar(false);
      if (avatarFileRef.current) avatarFileRef.current.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success('店铺外观设置已成功保存！');
      } else {
        toast.error('保存设置失败');
      }
    } catch {
      toast.error('保存设置出错');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="正在加载店铺外观设置..." />;
  }

  const activeBanner = formData.banner_image || DEFAULT_BANNER;
  const activeAvatar = formData.avatar_image || DEFAULT_AVATAR;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>店铺外观与橱窗展示设置</h1>
          <p className={styles.subtitle}>
            自定义顾客主页（Take.app 风格）的顶部横幅、圆形头像、店铺名、文案标语及货币符号。
          </p>
        </div>
        <Link href="/" target="_blank" className={styles.viewStoreBtn}>
          👁️ 预览顾客端主页
        </Link>
      </header>

      <form onSubmit={handleSave}>
        <div className={styles.layout}>
          {/* Editor Column */}
          <div className={styles.editorCol}>

            {/* 1. Banner Image */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>1. 顶部大横幅背景 (Hero Banner)</h2>
                <p>展示在手机端顶部的品牌大卡片背景图，建议比例 2:1 或 16:9。</p>
              </div>

              <div className={styles.uploadSection}>
                <div className={styles.bannerPreviewBox}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeBanner}
                    alt="店铺横幅预览"
                    className={styles.bannerPreviewImg}
                  />
                </div>

                <div className={styles.actionButtons}>
                  <input
                    type="file"
                    ref={bannerFileRef}
                    onChange={handleBannerFileSelect}
                    accept="image/*"
                    className={styles.hiddenInput}
                  />
                  <button
                    type="button"
                    onClick={() => bannerFileRef.current?.click()}
                    className={`${styles.btnAction} ${styles.btnActionPrimary}`}
                    disabled={uploadingBanner}
                  >
                    {uploadingBanner ? '正在上传...' : '📷 上传新横幅图片'}
                  </button>
                  {formData.banner_image && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, banner_image: '' }))}
                      className={styles.btnActionReset}
                    >
                      恢复默认横幅
                    </button>
                  )}
                </div>

                <div className={styles.formGroup} style={{ marginTop: '10px' }}>
                  <label htmlFor="banner_image">或者粘贴图片网址 (URL)</label>
                  <input
                    type="url"
                    id="banner_image"
                    name="banner_image"
                    value={formData.banner_image}
                    onChange={handleInputChange}
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>

                <div>
                  <div className={styles.presetTitle}>精选预设横幅（点击一键应用）：</div>
                  <div className={styles.presetGrid}>
                    {PRESET_BANNERS.map(b => (
                      <div
                        key={b.id}
                        className={`${styles.presetCard} ${formData.banner_image === b.url ? styles.presetCardActive : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, banner_image: b.url }))}
                      >
                        <div className={styles.presetThumb}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={b.url} alt={b.name} />
                        </div>
                        <div className={styles.presetName}>{b.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Avatar / Logo */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>2. 品牌圆形头像 / Logo (Store Avatar)</h2>
                <p>居中重叠在横幅底部的圆形品牌标识，建议正方形图片（1:1）。</p>
              </div>

              <div className={styles.uploadSection}>
                <div className={styles.avatarPreviewRow}>
                  <div className={styles.avatarPreviewBox}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeAvatar}
                      alt="品牌圆形Logo预览"
                      className={styles.avatarPreviewImg}
                    />
                  </div>

                  <div className={styles.actionButtons}>
                    <input
                      type="file"
                      ref={avatarFileRef}
                      onChange={handleAvatarFileSelect}
                      accept="image/*"
                      className={styles.hiddenInput}
                    />
                    <button
                      type="button"
                      onClick={() => avatarFileRef.current?.click()}
                      className={`${styles.btnAction} ${styles.btnActionPrimary}`}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? '正在上传...' : '📷 上传圆形Logo'}
                    </button>
                    {formData.avatar_image && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatar_image: '' }))}
                        className={styles.btnActionReset}
                      >
                        恢复默认Logo
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.formGroup} style={{ marginTop: '12px' }}>
                  <label htmlFor="avatar_image">或者粘贴Logo图片网址 (URL)</label>
                  <input
                    type="url"
                    id="avatar_image"
                    name="avatar_image"
                    value={formData.avatar_image}
                    onChange={handleInputChange}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div>
                  <div className={styles.presetTitle}>精选预设Logo（点击一键应用）：</div>
                  <div className={styles.presetGrid}>
                    {PRESET_AVATARS.map(a => (
                      <div
                        key={a.id}
                        className={`${styles.presetCard} ${formData.avatar_image === a.url ? styles.presetCardActive : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, avatar_image: a.url }))}
                      >
                        <div className={styles.presetThumb} style={{ display: 'flex', justifyContent: 'center' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.name} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                        </div>
                        <div className={styles.presetName}>{a.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Store Info & Text */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>3. 店铺信息与文字文案</h2>
                <p>调整店名、评分、所在地标签及公告胶囊。</p>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="store_name">店铺名称 (Store Name) *</label>
                  <input
                    type="text"
                    id="store_name"
                    name="store_name"
                    value={formData.store_name}
                    onChange={handleInputChange}
                    placeholder="例如：Bakery Sora 或 One Bite"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="store_bio">店铺公告标语胶囊 (Bio / Slogan)</label>
                  <input
                    type="text"
                    id="store_bio"
                    name="store_bio"
                    value={formData.store_bio}
                    onChange={handleInputChange}
                    placeholder="例如：Everything baked goods 🤎"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="cart_button_label">底部购物车常驻条文字</label>
                  <input
                    type="text"
                    id="cart_button_label"
                    name="cart_button_label"
                    value={formData.cart_button_label}
                    onChange={handleInputChange}
                    placeholder="购物车 或 View Cart"
                  />
                </div>
            </section>

            {/* Product photos hint */}
            <div className={styles.productHintBox}>
              <div className={styles.productHintText}>
                <strong>🍪 想更换单款曲奇的展示照片？</strong>
                <p>每款曲奇的封面图及多张大图请在「曲奇菜单管理」中直接点击编辑与上传。</p>
              </div>
              <Link href="/staff/products" className="btn btnSecondary" style={{ whiteSpace: 'nowrap' }}>
                前往曲奇菜单 →
              </Link>
            </div>

            <div className={styles.saveBar}>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={saving || uploadingBanner || uploadingAvatar}
              >
                {saving ? '正在保存中...' : '💾 保存所有外观更改'}
              </button>
            </div>
          </div>

          {/* Live Mobile Mockup Preview Column */}
          <div className={styles.previewCol}>
            <div className={styles.mockupPhone}>
              <div className={styles.mockupStatusBar}>
                <span>11:52</span>
                <span>📶 4G 🔋 95</span>
              </div>

              <div className={styles.mockupHeader}>
                <span style={{ fontSize: '1.1rem' }}>☰</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#666' }}>take.app</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>🔍</span>
                  <span style={{ position: 'relative' }}>
                    🛍️
                    <span style={{
                      position: 'absolute', top: '-4px', right: '-6px',
                      background: '#2c1d0f', color: '#fff', fontSize: '0.6rem',
                      borderRadius: '50%', width: '14px', height: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>2</span>
                  </span>
                </div>
              </div>

              <div className={styles.mockupScreen}>
                {/* Hero Banner in Mockup */}
                <div className={styles.mockupHeroBanner}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeBanner} alt="Hero Banner Preview" />
                </div>

                {/* Overlapping Avatar */}
                <div className={styles.mockupAvatarWrap}>
                  <div className={styles.mockupAvatar}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeAvatar} alt="Avatar Logo Preview" />
                  </div>
                </div>

                {/* Store Info */}
                <div className={styles.mockupInfo}>
                  <div className={styles.mockupTitle}>{formData.store_name || 'Bakery Sora'}</div>
                  <div className={styles.mockupRating}>
                    ⭐ {formData.store_rating || '5 (2)'} &gt;
                  </div>
                </div>

                {/* Bio Pill */}
                <div className={styles.mockupBioPill}>
                  {formData.store_bio || 'Everything baked goods 🤎'}
                </div>

                {/* Sample product list row */}
                <div style={{ padding: '0 14px 4px', fontSize: '0.88rem', fontWeight: 700, color: '#111' }}>
                  Cookies
                </div>
                <div className={styles.mockupProductSnippet}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#222' }}>Banana Bread Chocolate Chip</div>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>Banana bread in cookie form! 🍌</div>
                    <div style={{ fontWeight: 700, color: '#2c1d0f', marginTop: '4px' }}>
                      {formData.currency_symbol || '₱'}120.00
                    </div>
                  </div>
                  <div style={{
                    width: '50px', height: '50px', borderRadius: '8px',
                    background: '#e8decb', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '1.4rem'
                  }}>
                    🍪
                  </div>
                </div>

                {/* Sticky Cart pill */}
                <div className={styles.mockupCartSticky}>
                  <span className={styles.mockupCartBadge}>2</span>
                  <span>{formData.cart_button_label || '购物车'}</span>
                  <span>{formData.currency_symbol || '₱'}685.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
