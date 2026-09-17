'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function QrPaymentPage() {
  const { authFetch } = useAuth();
  const toast = useToast();
  
  const [settings, setSettings] = useState({
    qr_code: '',
    delivery_enabled: 'true',
    shop_phone: '',
    shop_email: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await authFetch('/api/settings');
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      toast.error('无法加载设置信息');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 'true' : 'false') : value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过 2MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setSettings(prev => ({ ...prev, qr_code: e.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const res = await authFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        toast.success('设置已成功保存');
      } else {
        toast.error('保存设置失败');
      }
    } catch (error) {
      toast.error('保存设置时发生错误');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="正在加载设置..." />;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>收款二维码与店铺配置</h1>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <form onSubmit={handleSubmit} className="card">
            <div className={styles.cardHeader}>
              <h2>DuitNow / 银行收款码配置</h2>
              <p>顾客在官网结算结账时将展示此收款二维码进行转账付款。</p>
            </div>
            
            <div className={styles.cardBody}>
              <div className={styles.qrSetup}>
                <div className={styles.qrPreview}>
                  {settings.qr_code ? (
                    <img src={settings.qr_code} alt="银行收款码" />
                  ) : (
                    <div className={styles.placeholder}>未上传收款码</div>
                  )}
                </div>
                
                <div className={styles.uploadControls}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className={styles.hiddenInput}
                  />
                  <button 
                    type="button" 
                    className="btn btnOutline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    上传新收款二维码
                  </button>
                  <p className={styles.helpText}>支持格式：JPG、PNG。文件大小不超过 2MB。</p>
                </div>
              </div>
            </div>
            
            <div className={styles.cardHeader} style={{ marginTop: '20px' }}>
              <h2>配送与客服联系方式</h2>
            </div>
            
            <div className={styles.cardBody}>
              <div className="formGroup mb3">
                <label className={styles.toggleLabel}>
                  <input 
                    type="checkbox" 
                    name="delivery_enabled"
                    checked={settings.delivery_enabled === 'true'}
                    onChange={handleInputChange}
                    className={styles.toggleInput}
                  />
                  <div className={styles.toggleSwitch}></div>
                  <div className={styles.toggleText}>
                    <strong>开启送货上门服务</strong>
                    <p>允许顾客在结算时选择送货上门（关闭时仅允许来店自取）</p>
                  </div>
                </label>
              </div>

              <div className={styles.grid2}>
                <div className="formGroup mb2">
                  <label htmlFor="shop_phone">店铺客服电话 / WhatsApp</label>
                  <input 
                    type="text" 
                    id="shop_phone"
                    name="shop_phone"
                    value={settings.shop_phone || ''}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="formGroup mb2">
                  <label htmlFor="shop_email">店铺客服邮箱</label>
                  <input 
                    type="email" 
                    id="shop_email"
                    name="shop_email"
                    value={settings.shop_email || ''}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </div>
            
            <div className={styles.cardFooter}>
              <button type="submit" className="btn btnPrimary" disabled={saving}>
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
