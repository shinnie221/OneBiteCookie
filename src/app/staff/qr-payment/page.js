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
      toast.error('Failed to load settings');
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
      toast.error('Image must be less than 2MB');
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
        toast.success('Settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading settings..." />;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Payment & Store Settings</h1>

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <form onSubmit={handleSubmit} className="card">
            <div className={styles.cardHeader}>
              <h2>Bank QR Code Setup</h2>
              <p>This QR code is displayed to customers during checkout.</p>
            </div>
            
            <div className={styles.cardBody}>
              <div className={styles.qrSetup}>
                <div className={styles.qrPreview}>
                  {settings.qr_code ? (
                    <img src={settings.qr_code} alt="Bank QR Code" />
                  ) : (
                    <div className={styles.placeholder}>No QR Code Uploaded</div>
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
                    Upload New QR Code
                  </button>
                  <p className={styles.helpText}>Supported formats: JPG, PNG. Max size: 2MB.</p>
                </div>
              </div>
            </div>
            
            <div className={styles.cardHeader} style={{ marginTop: '20px' }}>
              <h2>Store Options</h2>
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
                    <strong>Enable Delivery Option</strong>
                    <p>Allow customers to select delivery at checkout</p>
                  </div>
                </label>
              </div>

              <div className={styles.grid2}>
                <div className="formGroup mb2">
                  <label htmlFor="shop_phone">Support Phone Number</label>
                  <input 
                    type="text" 
                    id="shop_phone"
                    name="shop_phone"
                    value={settings.shop_phone || ''}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="formGroup mb2">
                  <label htmlFor="shop_email">Support Email</label>
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
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        <div className={styles.sideCol}>
          <div className="card">
            <div className={styles.cardHeader}>
              <h2>Payment Workflow</h2>
            </div>
            <div className={styles.cardBody}>
              <ol className={styles.workflowList}>
                <li>Customer adds cookies to cart</li>
                <li>Customer proceeds to checkout</li>
                <li>System displays the QR code uploaded here</li>
                <li>Customer scans and pays via their banking app</li>
                <li>Customer uploads the transaction receipt</li>
                <li>Order appears in Dashboard as "Pending Verification"</li>
                <li>Staff manually verifies receipt and accepts order</li>
                <li>Stock is automatically deducted</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
