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
import ImageCropperModal from '@/components/ImageCropperModal/ImageCropperModal';
import {
  AnnouncementStrip,
  ANNOUNCEMENT_UPDATED_EVENT,
  sanitizeAnnouncementLink
} from '@/components/AnnouncementBar/AnnouncementBar';
import styles from './page.module.css';

const ANNOUNCEMENT_MAX_LENGTH = 160;
// Keep inline (data URL) images well under Firestore's 1 MiB document limit
const MAX_INLINE_IMAGE_LENGTH = 600 * 1024;

export default function StorefrontSettingsPage() {
  const { authFetch } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState(null);

  // Image Cropper States
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState('banner'); // 'banner' | 'avatar'
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [isCroppingProcessing, setIsCroppingProcessing] = useState(false);

  const bannerFileRef = useRef(null);
  const avatarFileRef = useRef(null);

  const [formData, setFormData] = useState({
    banner_image: '',
    avatar_image: '',
    currency_symbol: 'RM',
    cart_button_label: '购物车',
    announcement_enabled: false,
    announcement_text: '',
    announcement_link: '',
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
            currency_symbol: data.settings.currency_symbol || 'RM',
            cart_button_label: data.settings.cart_button_label || '购物车',
            announcement_enabled: Boolean(data.settings.announcement_enabled),
            announcement_text: data.settings.announcement_text || '',
            announcement_link: data.settings.announcement_link || '',
          }));
          setAnnouncementUpdatedAt(data.settings.announcement_updated_at || null);
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

  // Write a single image field straight to Firestore so uploads never sit unsaved in local state
  const persistImageField = async (field, url) => {
    const res = await authFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: url })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error(`Saving ${field} failed:`, data);
      throw new Error('图片已上传，但保存到店铺设置失败，请重试');
    }
    setFormData(prev => ({ ...prev, [field]: url }));
  };

  // Upload, save to Firestore, then apply image helper
  const uploadAndApplyImage = async (fileOrBlob, fallbackDataUrl, target) => {
    let finalUrl = '';
    try {
      finalUrl = await uploadImageToImgBB(fileOrBlob);
    } catch {
      finalUrl = fallbackDataUrl || await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(fileOrBlob);
      });
    }

    // If ImgBB is unavailable the image falls back to an inline data URL, which lives inside the
    // settings document. Firestore caps a document at 1 MiB, so refuse anything that would blow it.
    if (finalUrl.startsWith('data:') && finalUrl.length > MAX_INLINE_IMAGE_LENGTH) {
      throw new Error('图床暂时无法上传，且图片过大无法直接保存，请稍后重试或换一张较小的图片');
    }

    const field = target === 'banner' ? 'banner_image' : 'avatar_image';
    await persistImageField(field, finalUrl);
    toast.success(target === 'banner' ? '横幅背景图片已保存并同步到顾客主页！' : '圆形Logo已保存并同步到顾客主页！');
  };

  // Open cropper for new file upload
  const handleBannerFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('图片文件过大，请选择小于 25MB 的照片');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropTarget('banner');
    setCropImageSrc(objectUrl);
    setPendingFile(file);
    setCropModalOpen(true);
    if (bannerFileRef.current) bannerFileRef.current.value = '';
  };

  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('图片文件过大，请选择小于 25MB 的照片');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropTarget('avatar');
    setCropImageSrc(objectUrl);
    setPendingFile(file);
    setCropModalOpen(true);
    if (avatarFileRef.current) avatarFileRef.current.value = '';
  };

  // Open cropper to crop existing / active image
  const handleOpenCropModal = (target, currentSrc) => {
    if (!currentSrc) {
      toast.info('请先上传或选择一张图片后再进行裁剪');
      return;
    }
    setCropTarget(target);
    setCropImageSrc(currentSrc);
    setPendingFile(null);
    setCropModalOpen(true);
  };

  // Restore the built-in default banner / logo (saved immediately like uploads)
  const handleResetImage = async (field) => {
    try {
      await persistImageField(field, '');
      toast.success(field === 'banner_image' ? '已恢复默认横幅' : '已恢复默认Logo');
    } catch (err) {
      toast.error(err?.message || '恢复默认失败');
    }
  };

  // Confirm cropped image handler
  const handleConfirmCrop = async (croppedBlob, croppedDataUrl) => {
    setIsCroppingProcessing(true);
    try {
      const filename = `${cropTarget}_cropped_${Date.now()}.jpg`;
      const croppedFile = new File([croppedBlob], filename, { type: 'image/jpeg' });
      await uploadAndApplyImage(croppedFile, croppedDataUrl, cropTarget);
      setCropModalOpen(false);
      setPendingFile(null);
    } catch (err) {
      console.error('Cropped image upload error:', err);
      toast.error(err?.message || '保存裁剪图片失败，请重试');
    } finally {
      setIsCroppingProcessing(false);
    }
  };

  // Skip crop handler: uploads the raw pending file without cropping
  const handleSkipCrop = async () => {
    if (!pendingFile) {
      setCropModalOpen(false);
      return;
    }
    setIsCroppingProcessing(true);
    try {
      await uploadAndApplyImage(pendingFile, null, cropTarget);
      setCropModalOpen(false);
      setPendingFile(null);
    } catch (err) {
      console.error('Skip crop upload error:', err);
      toast.error(err?.message || '上传图片失败');
    } finally {
      setIsCroppingProcessing(false);
    }
  };

  // Normalised announcement fields, stamped with the publish time
  const buildAnnouncementPayload = (overrides = {}) => {
    const merged = { ...formData, ...overrides };
    return {
      announcement_enabled: Boolean(merged.announcement_enabled) && merged.announcement_text.trim() !== '',
      announcement_text: merged.announcement_text.trim().slice(0, ANNOUNCEMENT_MAX_LENGTH),
      announcement_link: sanitizeAnnouncementLink(merged.announcement_link),
      announcement_updated_at: new Date().toISOString(),
    };
  };

  // Push the saved announcement to the live bar in this browser (other visitors pick it up on next load / tab focus)
  const broadcastAnnouncement = (payload) => {
    setAnnouncementUpdatedAt(payload.announcement_updated_at);
    setFormData(prev => ({
      ...prev,
      announcement_enabled: payload.announcement_enabled,
      announcement_text: payload.announcement_text,
      announcement_link: payload.announcement_link,
    }));
    window.dispatchEvent(new CustomEvent(ANNOUNCEMENT_UPDATED_EVENT, {
      detail: {
        enabled: payload.announcement_enabled,
        text: payload.announcement_text,
        link: payload.announcement_link,
        updated_at: payload.announcement_updated_at,
      }
    }));
  };

  // Publish / take down the announcement on its own, without saving the rest of the form
  const handlePublishAnnouncement = async (enabled) => {
    if (enabled && !formData.announcement_text.trim()) {
      toast.error('请先填写公告内容');
      return;
    }
    if (formData.announcement_link.trim() && !sanitizeAnnouncementLink(formData.announcement_link)) {
      toast.error('链接需以 https:// 或 / 开头');
      return;
    }

    setPublishingAnnouncement(true);
    try {
      const payload = buildAnnouncementPayload({ announcement_enabled: enabled });
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        broadcastAnnouncement(payload);
        toast.success(enabled ? '公告已发布到顶部公告栏！' : '公告已撤下');
      } else {
        toast.error('发布公告失败');
      }
    } catch {
      toast.error('发布公告出错');
    } finally {
      setPublishingAnnouncement(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.announcement_link.trim() && !sanitizeAnnouncementLink(formData.announcement_link)) {
      toast.error('公告链接需以 https:// 或 / 开头');
      return;
    }

    setSaving(true);
    try {
      const announcementPayload = buildAnnouncementPayload();
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, ...announcementPayload })
      });

      if (res.ok) {
        broadcastAnnouncement(announcementPayload);
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
            自定义顾客主页（Take.app 风格）的顶部横幅、圆形头像及顶部公告栏。
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
                  <button
                    type="button"
                    onClick={() => handleOpenCropModal('banner', activeBanner)}
                    className={`${styles.btnAction} ${styles.btnActionCrop}`}
                    title="裁剪并重新调整当前横幅画面比例与构图"
                  >
                    ✂️ 裁剪横幅图片
                  </button>
                  {formData.banner_image && (
                    <button
                      type="button"
                      onClick={() => handleResetImage('banner_image')}
                      className={styles.btnActionReset}
                    >
                      恢复默认横幅
                    </button>
                  )}
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
                    <button
                      type="button"
                      onClick={() => handleOpenCropModal('avatar', activeAvatar)}
                      className={`${styles.btnAction} ${styles.btnActionCrop}`}
                      title="裁剪并重新调整当前Logo画面比例与圆形对齐"
                    >
                      ✂️ 裁剪圆形Logo
                    </button>
                    {formData.avatar_image && (
                      <button
                        type="button"
                        onClick={() => handleResetImage('avatar_image')}
                        className={styles.btnActionReset}
                      >
                        恢复默认Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Announcement Bar */}
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>3. 顶部公告栏 (Announcement Bar)</h2>
                <p>固定显示在顾客端所有页面最顶部的公告条，可用于通知取货时间、促销活动、暂停接单等。</p>
              </div>

              <div className={styles.announceStatusRow}>
                <span className={`${styles.announceStatus} ${formData.announcement_enabled ? styles.announceStatusLive : ''}`}>
                  {formData.announcement_enabled ? '● 公告展示中' : '○ 公告未展示'}
                </span>
                {announcementUpdatedAt && (
                  <span className={styles.helperText}>
                    最后更新：{new Date(announcementUpdatedAt).toLocaleString('zh-CN', { hour12: false })}
                  </span>
                )}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="announcement_text">公告内容 *</label>
                <textarea
                  id="announcement_text"
                  name="announcement_text"
                  rows={2}
                  maxLength={ANNOUNCEMENT_MAX_LENGTH}
                  value={formData.announcement_text}
                  onChange={handleInputChange}
                  placeholder="例如：🎉 新品 Strawberry White Choc 上架！下次取货时间：11月1日 11am"
                  className={styles.bioTextarea}
                />
                <span className={styles.helperText}>
                  {formData.announcement_text.length} / {ANNOUNCEMENT_MAX_LENGTH} 字 · 建议一句话，手机端会自动换行
                </span>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="announcement_link">点击跳转链接（可选）</label>
                <input
                  type="text"
                  id="announcement_link"
                  name="announcement_link"
                  value={formData.announcement_link}
                  onChange={handleInputChange}
                  placeholder="例如：/#menu 或 https://instagram.com/onebite"
                />
                <span className={styles.helperText}>留空则公告不可点击；站内页面以 / 开头，外部链接以 https:// 开头</span>
              </div>

              <div className={styles.actionButtons}>
                <button
                  type="button"
                  onClick={() => handlePublishAnnouncement(true)}
                  className={`${styles.btnAction} ${styles.btnActionPrimary}`}
                  disabled={publishingAnnouncement || saving}
                >
                  {publishingAnnouncement
                    ? '正在发布...'
                    : formData.announcement_enabled ? '📢 更新公告' : '📢 立即发布公告'}
                </button>
                {formData.announcement_enabled && (
                  <button
                    type="button"
                    onClick={() => handlePublishAnnouncement(false)}
                    className={styles.btnActionReset}
                    disabled={publishingAnnouncement || saving}
                  >
                    撤下公告
                  </button>
                )}
              </div>
            </section>

            <div className={styles.saveBar}>
              <button
                type="submit"
                className={styles.saveBtn}
                disabled={saving || uploadingBanner || uploadingAvatar}
              >
                {saving ? '正在保存中...' : ' 保存所有外观更改'}
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

              {formData.announcement_text.trim() && (
                <div className={formData.announcement_enabled ? '' : styles.mockupAnnounceDraft}>
                  <AnnouncementStrip
                    text={formData.announcement_text}
                    link={formData.announcement_link}
                    compact
                  />
                </div>
              )}

              <div className={styles.mockupHeader}>
                <span style={{ fontSize: '1.1rem' }}>☰</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#666' }}>take.app</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span>🔍</span>
                  <span style={{ position: 'relative' }}>
                    �
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

      {/* Interactive Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        onClose={() => {
          if (!isCroppingProcessing) {
            setCropModalOpen(false);
            setPendingFile(null);
          }
        }}
        imageSrc={cropImageSrc}
        cropType={cropTarget}
        title={cropTarget === 'banner' ? '✂️ 裁剪店铺大横幅背景图片' : '✂️ 裁剪品牌圆形Logo / 头像'}
        onConfirmCrop={handleConfirmCrop}
        onSkipCrop={pendingFile ? handleSkipCrop : null}
        isProcessing={isCroppingProcessing}
      />
    </div>
  );
}
