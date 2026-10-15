'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Navbar from '@/components/Navbar/Navbar';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import {
  ADDRESS_LABELS,
  formatFullAddress,
  isStateDeliverable,
  WHATSAPP_RAW_PHONE,
  WHATSAPP_INQUIRY_URL
} from '@/lib/addresses.mjs';
import {
  Cookie,
  Sparkles,
  MapPin,
  Package,
  Star,
  AlertTriangle,
  Edit3,
  Trash2,
  Phone,
  MessageCircle,
  X,
  ExternalLink,
  Home,
  Building2
} from 'lucide-react';
import styles from './page.module.css';

const initialAddressState = {
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: 'Kuala Lumpur',
  postcode: '',
  label: 'Home',
  isDefault: false
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, authFetch, logout } = useAuth();
  const toast = useToast();

  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [addresses, setAddresses] = useState([]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    router.push('/');
  };

  // Modal states for Address Add/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState(initialAddressState);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const res = await authFetch('/api/user/profile');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');

      if (data.user) {
        setProfile({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phone || ''
        });
        setAddresses(Array.isArray(data.user.addresses) ? data.user.addresses : []);
      }
    } catch (err) {
      toast.error(err.message || 'Unable to load profile.');
    } finally {
      setProfileLoading(false);
    }
  }, [authFetch, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      toast.info('Please sign in to access your profile.');
      router.push('/login');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile();
  }, [isAuthenticated, authLoading, router, toast, loadProfile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await authFetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save personal information');

      toast.success('Personal information updated successfully!');
      if (data.user) {
        setProfile({
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone
        });
      }
    } catch (err) {
      toast.error(err.message || 'Update failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setAddressForm({
      ...initialAddressState,
      recipientName: profile.name || '',
      phone: profile.phone || '',
      state: 'Kuala Lumpur',
      isDefault: addresses.length === 0
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (addr) => {
    setEditingAddress(addr);
    setAddressForm({
      recipientName: addr.recipientName || '',
      phone: addr.phone || '',
      addressLine1: addr.addressLine1 || '',
      addressLine2: addr.addressLine2 || '',
      city: addr.city || '',
      state: 'Kuala Lumpur',
      postcode: addr.postcode || '',
      label: addr.label || 'Home',
      isDefault: Boolean(addr.isDefault)
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      setModalSaving(true);
      const isEdit = Boolean(editingAddress);
      const url = isEdit
        ? `/api/user/addresses/${editingAddress.id}`
        : '/api/user/addresses';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...addressForm,
        state: 'Kuala Lumpur'
      };

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save address');

      toast.success(isEdit ? 'Address updated successfully!' : 'New address added!');
      if (Array.isArray(data.addresses)) {
        setAddresses(data.addresses);
      }
      // If customer phone was empty, sync from the address
      if (!profile.phone && addressForm.phone) {
        setProfile(prev => ({ ...prev, phone: addressForm.phone }));
      }
      setModalOpen(false);
    } catch (err) {
      setModalError(err.message || 'Could not save address.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleSetDefault = async (addrId) => {
    try {
      const res = await authFetch(`/api/user/addresses/${addrId}`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set default address');

      toast.success('Default delivery address updated!');
      if (Array.isArray(data.addresses)) {
        setAddresses(data.addresses);
      }
    } catch (err) {
      toast.error(err.message || 'Action failed.');
    }
  };

  const handleDeleteAddress = async (addrId) => {
    if (!window.confirm('Are you sure you want to delete this delivery address?')) {
      return;
    }
    try {
      const res = await authFetch(`/api/user/addresses/${addrId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete address');

      toast.success('Address deleted.');
      if (Array.isArray(data.addresses)) {
        setAddresses(data.addresses);
      }
    } catch (err) {
      toast.error(err.message || 'Delete failed.');
    }
  };

  if (authLoading || profileLoading) {
    return (
      <>
        <Navbar />
        <main className={styles.container}>
          <LoadingSpinner text="Loading your profile..." />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className={styles.container}>
        {/* Page Header */}
        <header className={styles.pageHeader}>
          <div className={styles.profileAvatarBox}>
            <div className={styles.avatar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile.name ? profile.name.charAt(0).toUpperCase() : <Cookie size={28} />}
            </div>
            <div className={styles.profileTitleLine}>
              <h1>{profile.name || 'Customer Profile'}</h1>
              <span className={styles.profileBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={13} /> One Bite Member
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Log out of your account"
          >
            Log Out
          </button>
        </header>

        {/* Section 1: Personal Information */}
        <section className={styles.card} aria-labelledby="personal-info-title">
          <div className={styles.cardHeader}>
            <div>
              <h2 id="personal-info-title" className={styles.cardTitle}>
                Personal Information
              </h2>
              <p className={styles.cardSubtitle}>
                Manage your name and contact phone number. These details will be automatically pre-filled at checkout.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label htmlFor="customer-name">Full Name *</label>
                <input
                  id="customer-name"
                  type="text"
                  required
                  maxLength={100}
                  value={profile.name}
                  onChange={e => setProfile({ ...profile, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="customer-email">Email Address</label>
                <input
                  id="customer-email"
                  type="email"
                  disabled
                  value={profile.email}
                  title="Registered account email cannot be modified"
                />
              </div>

              <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                <label htmlFor="customer-phone">Contact Phone Number *</label>
                <input
                  id="customer-phone"
                  type="tel"
                  maxLength={50}
                  value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="e.g. 012-345 6789 or +60123456789"
                />
              </div>
            </div>

            <div className={styles.cardActions}>
              <button
                type="submit"
                className="btn btnPrimary"
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving...' : ' Save Information'}
              </button>
            </div>
          </form>
        </section>

        {/* Section 2: Delivery Addresses */}
        <section className={styles.card} aria-labelledby="addresses-title">
          <div className={styles.cardHeader}>
            <div>
              <h2 id="addresses-title" className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={20} /> Delivery Addresses
              </h2>
              <p className={styles.cardSubtitle}>
                Save multiple delivery addresses and set your default. Standard delivery is strictly specific to <strong>Kuala Lumpur</strong>. Other states are not acceptable, except <strong>Klang Valley</strong> area where you can WhatsApp us for inquiry.
              </p>
            </div>
            <button
              type="button"
              className="btn btnPrimary"
              onClick={handleOpenAddModal}
            >
              + Add New Address
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={38} />
              </span>
              <strong>No saved delivery addresses yet</strong>
              <p>Add an address to enjoy quick and seamless 1-click checkout.</p>
              <button
                type="button"
                className="btn btnSecondary"
                onClick={handleOpenAddModal}
                style={{ marginTop: '8px' }}
              >
                + Add Your First Address
              </button>
            </div>
          ) : (
            <div className={styles.addressList}>
              {addresses.map(addr => {
                const labelObj = ADDRESS_LABELS.find(l => l.value === addr.label);
                const isDeliverable = isStateDeliverable(addr.state);
                return (
                  <div
                    key={addr.id}
                    className={`${styles.addressCard} ${addr.isDefault ? styles.addressCardDefault : ''}`}
                  >
                    <div className={styles.addressCardHeader}>
                      <div className={styles.badgeGroup}>
                        <span className={styles.labelBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {addr.label === 'Office' ? <Building2 size={12} /> : (addr.label === 'Other' ? <MapPin size={12} /> : <Home size={12} />)}
                          {labelObj ? labelObj.label : addr.label || 'Home'}
                        </span>
                        {addr.isDefault && (
                          <span className={styles.defaultBadge} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Star size={11} fill="currentColor" /> Default Address
                          </span>
                        )}
                        {isDeliverable ? (
                          <span className={styles.deliveryOkBadge} title="Standard delivery available">
                            KL Delivery Available
                          </span>
                        ) : (
                          <span className={styles.deliveryNoBadge} title="Other states not acceptable. Klang Valley can WhatsApp for inquiry." style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <AlertTriangle size={11} /> Not Acceptable (Klang Valley Inquiry via WhatsApp)
                          </span>
                        )}
                      </div>

                      <div className={styles.addressActions}>
                        {!addr.isDefault && (
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => handleSetDefault(addr.id)}
                            title="Set as default delivery address"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => handleOpenEditModal(addr)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit3 size={13} /> Edit
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={() => handleDeleteAddress(addr.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>

                    <div className={styles.addressBody}>
                      <div className={styles.recipientLine}>
                        <span>{addr.recipientName}</span>
                        <span className={styles.recipientPhone} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={13} /> {addr.phone}
                        </span>
                        {!isDeliverable && (
                          <a
                            href={WHATSAPP_INQUIRY_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.whatsappCardLink}
                            title="Inquire for Klang Valley delivery via WhatsApp"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <MessageCircle size={13} /> Klang Valley Inquiry
                          </a>
                        )}
                      </div>
                      <p className={styles.addressText}>
                        {formatFullAddress(addr)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Address Form Modal Dialog */}
      {modalOpen && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>{editingAddress ? 'Edit Delivery Address' : 'Add New Delivery Address'}</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress}>
              <div className={styles.modalBody}>
                {modalError && (
                  <div className={styles.errorBanner} role="alert" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <AlertTriangle size={15} /> {modalError}
                  </div>
                )}

                <div className={styles.formGroup}>
                  <label>Address Label</label>
                  <div className={styles.labelButtonGroup}>
                    {ADDRESS_LABELS.map(l => {
                      const IconComponent = l.value === 'Home' ? Home : (l.value === 'Office' ? Building2 : MapPin);
                      return (
                        <button
                          key={l.value}
                          type="button"
                          className={`${styles.labelBtn} ${addressForm.label === l.value ? styles.labelBtnActive : ''}`}
                          onClick={() => setAddressForm({ ...addressForm, label: l.value })}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <IconComponent size={13} />
                          {l.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="addr-recipient">Recipient Name *</label>
                    <input
                      id="addr-recipient"
                      type="text"
                      required
                      maxLength={100}
                      value={addressForm.recipientName}
                      onChange={e => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="addr-phone">Phone Number *</label>
                    <input
                      id="addr-phone"
                      type="tel"
                      required
                      maxLength={50}
                      value={addressForm.phone}
                      onChange={e => setAddressForm({ ...addressForm, phone: e.target.value })}
                      placeholder="e.g. 012-345 6789"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="addr-line1">Street Address Line 1 *</label>
                  <input
                    id="addr-line1"
                    type="text"
                    required
                    maxLength={200}
                    value={addressForm.addressLine1}
                    onChange={e => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                    placeholder="e.g. No. 12, Jalan Bukit Bintang"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="addr-line2">Unit / Building / Floor (Address Line 2, Optional)</label>
                  <input
                    id="addr-line2"
                    type="text"
                    maxLength={200}
                    value={addressForm.addressLine2}
                    onChange={e => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                    placeholder="e.g. Pavilion Residences, Block B, Unit 12-03"
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor="addr-city">City *</label>
                    <input
                      id="addr-city"
                      type="text"
                      required
                      maxLength={100}
                      value={addressForm.city}
                      onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                      placeholder="e.g. Cheras"
                    />
                  </div>

                  {/* Specific to Kuala Lumpur - No dropdown list */}
                  <div className={styles.formGroup}>
                    <label htmlFor="addr-state">State *</label>
                    <input
                      id="addr-state"
                      type="text"
                      value="Kuala Lumpur"
                      readOnly
                      style={{
                        background: '#f8fafc',
                        color: 'var(--color-text)',
                        cursor: 'default',
                        fontWeight: 600
                      }}
                    />
                  </div>

                  <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label htmlFor="addr-postcode">Postal Code *</label>
                    <input
                      id="addr-postcode"
                      type="text"
                      required
                      maxLength={5}
                      value={addressForm.postcode}
                      onChange={e => setAddressForm({ ...addressForm, postcode: e.target.value.replace(/\D/g, '') })}
                      placeholder="e.g. 55100"
                    />
                  </div>

                  {/* Delivery coverage notice banner for Klang Valley */}
                  <div className={`${styles.stateNoticeInModal} ${styles.formGridFull}`}>
                    <div>
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} /> Delivery Coverage Notice:{' '}
                      </strong>
                      Standard online delivery is strictly specific to <strong>Kuala Lumpur</strong>. Other states are not acceptable. However, if your address is within the <strong>Klang Valley</strong> area, please contact us on WhatsApp for delivery inquiry.
                    </div>
                    <a
                      href={WHATSAPP_INQUIRY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.modalWhatsAppLink}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <MessageCircle size={14} /> Inquire for Klang Valley Delivery via WhatsApp (011-10897061) <ExternalLink size={13} />
                    </a>
                  </div>
                </div>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    disabled={addresses.length === 0}
                    onChange={e => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  />
                  <span>Set as default delivery address</span>
                </label>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className="btn btnSecondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btnPrimary"
                  disabled={modalSaving}
                >
                  {modalSaving ? 'Saving...' : ' Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
