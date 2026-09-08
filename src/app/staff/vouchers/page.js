'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export default function VouchersPage() {
  const { authFetch } = useAuth();
  const toast = useToast();

  const [vouchers, setVouchers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const defaultForm = {
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order: 0,
    expiry_date: '',
    active: true,
    is_public: true, // Visible in Cart page
    usage_limit: 'unlimited', // 'unlimited' | 'once_total' | 'once_per_customer'
    target_type: 'all', // 'all' | 'specific_customer'
    customer_email: '',
    customer_name: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    fetchVouchers();
    fetchCustomers();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/vouchers');
      const data = await res.json();
      if (res.ok) {
        setVouchers(data.vouchers || []);
      } else {
        toast.error(data.error || 'Failed to load vouchers');
      }
    } catch (error) {
      toast.error('Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await authFetch('/api/customers');
      const data = await res.json();
      if (res.ok && data.customers) {
        setCustomers(data.customers);
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
    }
  };

  const openAddModal = () => {
    setEditingVoucher(null);
    setFormData(defaultForm);
    setIsModalOpen(true);
  };

  const openEditModal = (voucher) => {
    setEditingVoucher(voucher);
    setFormData({
      code: voucher.code,
      discount_type: voucher.discount_type,
      discount_value: voucher.discount_value,
      min_order: voucher.min_order,
      expiry_date: voucher.expiry_date || '',
      active: voucher.active === 1 || voucher.active === true,
      is_public: voucher.is_public !== false,
      usage_limit: voucher.usage_limit || 'unlimited',
      target_type: voucher.target_type || (voucher.customer_email ? 'specific_customer' : 'all'),
      customer_email: voucher.customer_email || '',
      customer_name: voucher.customer_name || '',
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : parseFloat(value)) : value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.target_type === 'specific_customer' && !formData.customer_email.trim()) {
      toast.error('Please select or enter the recipient customer email');
      return;
    }

    setActionLoading(true);

    try {
      const url = editingVoucher
        ? `/api/vouchers/${editingVoucher.id}`
        : '/api/vouchers';

      const method = editingVoucher ? 'PUT' : 'POST';

      // format data
      const payload = { ...formData };
      if (!payload.expiry_date) payload.expiry_date = null;
      if (payload.target_type === 'all') {
        payload.customer_email = null;
        payload.customer_name = null;
      }

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(editingVoucher ? 'Voucher updated' : 'Voucher created');
        setIsModalOpen(false);
        fetchVouchers();
      } else {
        toast.error(data.error || 'Failed to save voucher');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this voucher?')) return;

    try {
      const res = await authFetch(`/api/vouchers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Voucher deleted');
        fetchVouchers();
      } else {
        toast.error('Failed to delete voucher');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const toggleStatus = async (voucher) => {
    try {
      const res = await authFetch(`/api/vouchers/${voucher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: voucher.active === 1 ? false : true })
      });

      if (res.ok) {
        toast.success(`Voucher ${voucher.active === 1 ? 'deactivated' : 'activated'}`);
        fetchVouchers();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const isExpired = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vouchers & Discounts</h1>
          <p className={styles.subtitle}>Create public vouchers for all customers, or give exclusive single-use vouchers directly to specific customers.</p>
        </div>
        <button onClick={openAddModal} className="btn btnPrimary" style={{ fontWeight: 600 }}>
          + Create Voucher
        </button>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Recipient / Target</th>
                  <th>Min Order</th>
                  <th>Cart Visibility</th>
                  <th>Usage Limit</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="textCenter" style={{ padding: '30px', color: 'var(--color-text-light)' }}>
                      No vouchers found
                    </td>
                  </tr>
                ) : (
                  vouchers.map(voucher => {
                    const expired = isExpired(voucher.expiry_date);
                    const isPublic = voucher.is_public !== false;
                    const usageLimit = voucher.usage_limit || 'unlimited';
                    const timesUsed = voucher.times_used || 0;
                    const isSpecific = voucher.target_type === 'specific_customer' || Boolean(voucher.customer_email);

                    return (
                      <tr key={voucher.id} className={!voucher.active || expired ? styles.inactiveRow : ''}>
                        <td className={styles.codeCell}>{voucher.code}</td>
                        <td className={styles.discountCell}>
                          {voucher.discount_type === 'percentage'
                            ? `${voucher.discount_value}% OFF`
                            : `RM${Number(voucher.discount_value).toFixed(2)} OFF`}
                        </td>

                        {/* Recipient / Target */}
                        <td>
                          {isSpecific ? (
                            <span
                              className={styles.badgeTargetCustomer}
                              title={`Exclusive to: ${voucher.customer_name ? `${voucher.customer_name} (${voucher.customer_email})` : voucher.customer_email}`}
                            >
                              👤 {voucher.customer_name || voucher.customer_email}
                            </span>
                          ) : (
                            <span className={styles.badgeTargetAll} title="Available to all customers">
                              🌐 All Customers
                            </span>
                          )}
                        </td>

                        <td>RM{Number(voucher.min_order || 0).toFixed(2)}</td>

                        {/* Cart Visibility */}
                        <td>
                          {isPublic ? (
                            <span className={styles.badgeVisible} title={isSpecific ? "Only this customer can see it in their cart" : "All customers can see it in their cart"}>
                              👁️ Visible in Cart {isSpecific && '(Exclusive)'}
                            </span>
                          ) : (
                            <span className={styles.badgeHidden} title="Hidden from cart. Customer must type code manually">
                              🔒 Secret / Hidden
                            </span>
                          )}
                        </td>

                        {/* Usage Limit */}
                        <td>
                          {usageLimit === 'once_total' ? (
                            <span className={styles.badgeSingleUse} title="Can only be used once total">
                              ⚡ Single-Use ({timesUsed}/1)
                            </span>
                          ) : usageLimit === 'once_per_customer' ? (
                            <span className={styles.badgeOnceUser} title="Each customer can use it once">
                              👤 Once / Customer ({timesUsed} used)
                            </span>
                          ) : (
                            <span className={styles.badgeUnlimited} title="Unlimited uses">
                              ♾️ Unlimited ({timesUsed} used)
                            </span>
                          )}
                        </td>

                        <td>
                          {voucher.expiry_date ? (
                            <span className={expired ? styles.textError : ''}>
                              {new Date(voucher.expiry_date).toLocaleDateString()}
                              {expired && ' (Expired)'}
                            </span>
                          ) : 'No Expiry'}
                        </td>
                        <td>
                          <button
                            className={`${styles.statusToggle} ${voucher.active ? styles.statusActive : styles.statusInactive}`}
                            onClick={() => toggleStatus(voucher)}
                            title="Click to toggle status"
                          >
                            {voucher.active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td>
                          <div className="flex gap1">
                            <button onClick={() => openEditModal(voucher)} className="btn btnSecondary" style={{ padding: '6px 12px' }}>Edit</button>
                            <button onClick={() => handleDelete(voucher.id)} className="btn btnDanger" style={{ padding: '6px 12px' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !actionLoading && setIsModalOpen(false)}
        title={editingVoucher ? 'Edit Voucher' : 'Create Voucher'}
        maxWidth="680px"
      >
        <form onSubmit={handleSubmit} className={styles.form}>

          <div className="formGroup mb2">
            <label htmlFor="code">Voucher Code *</label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="e.g. SPECIAL-FOR-YOU, WELCOME10"
              required
              style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}
            />
          </div>

          <div className={styles.grid2}>
            <div className="formGroup mb2">
              <label htmlFor="discount_type">Discount Type *</label>
              <select
                id="discount_type"
                name="discount_type"
                value={formData.discount_type}
                onChange={handleInputChange}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (RM)</option>
              </select>
            </div>

            <div className="formGroup mb2">
              <label htmlFor="discount_value">
                Discount Value *
                {formData.discount_type === 'percentage' ? ' (%)' : ' (RM)'}
              </label>
              <input
                type="number"
                id="discount_value"
                name="discount_value"
                min="0.1"
                step="any"
                value={formData.discount_value}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className="formGroup mb2">
              <label htmlFor="min_order">Minimum Order (RM) *</label>
              <input
                type="number"
                id="min_order"
                name="min_order"
                min="0"
                step="any"
                value={formData.min_order}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="formGroup mb2">
              <label htmlFor="expiry_date">Expiry Date (Optional)</label>
              <input
                type="date"
                id="expiry_date"
                name="expiry_date"
                value={formData.expiry_date}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Target Recipient Section (Specific Customer vs All) */}
          <div className={styles.configBlock}>
            <label className={styles.configHeader}>🎯 Target Recipient (发放对象)</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="target_type"
                  value="all"
                  checked={formData.target_type === 'all'}
                  onChange={() => setFormData(prev => ({ ...prev, target_type: 'all', customer_email: '', customer_name: '' }))}
                />
                <div>
                  <strong>🌐 All Customers (公开给所有顾客)</strong>
                  <p>所有顾客都可使用。如果设置为可见，所有人都会在购物车中看到。</p>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="target_type"
                  value="specific_customer"
                  checked={formData.target_type === 'specific_customer'}
                  onChange={() => setFormData(prev => ({ ...prev, target_type: 'specific_customer' }))}
                />
                <div>
                  <strong>👤 Specific Customer (专属给指定顾客 - 仅该顾客可见且可用)</strong>
                  <p>非常适合单次专属补偿/奖励。若设为可见，<strong>只有该顾客登录后能在购物车看到</strong>，其他人无法看到也无法抢用。</p>
                </div>
              </label>
            </div>

            {formData.target_type === 'specific_customer' && (
              <div className={styles.customerSelectBox}>
                <label className={styles.subLabel}>选择或输入顾客邮箱 *</label>

                {customers.length > 0 && (
                  <select
                    className={styles.select}
                    value={formData.customer_email}
                    onChange={(e) => {
                      const selectedEmail = e.target.value;
                      const matched = customers.find(c => (c.email || '').toLowerCase() === selectedEmail.toLowerCase());
                      setFormData(prev => ({
                        ...prev,
                        customer_email: selectedEmail,
                        customer_name: matched ? (matched.name || matched.customer_name || '') : ''
                      }));
                    }}
                    style={{ marginBottom: '8px' }}
                  >
                    <option value="">-- 从已注册顾客中快捷选择 --</option>
                    {customers.map(c => (
                      <option key={c.id || c.email} value={c.email}>
                        {c.name || 'Customer'} ({c.email}) {c.phone ? `- ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}

                <input
                  type="email"
                  className={styles.input}
                  placeholder="或直接输入顾客注册邮箱，例如: customer@gmail.com"
                  value={formData.customer_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                  required={formData.target_type === 'specific_customer'}
                />
              </div>
            )}
          </div>

          {/* Cart Visibility Toggle */}
          <div className={styles.configBlock}>
            <label className={styles.configHeader}>🛒 Cart Visibility (购物车展示)</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="is_public"
                  checked={formData.is_public === true}
                  onChange={() => setFormData(prev => ({ ...prev, is_public: true }))}
                />
                <div>
                  <strong>👁️ Visible in Cart Page (在购物车展示)</strong>
                  <p>
                    {formData.target_type === 'specific_customer'
                      ? '⭐ 仅专属顾客登录后能在其购物车看到卡片，其他人看不到。'
                      : '所有顾客都能在购物车看到并一键领取使用。'}
                  </p>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="is_public"
                  checked={formData.is_public === false}
                  onChange={() => setFormData(prev => ({ ...prev, is_public: false }))}
                />
                <div>
                  <strong>🔒 Invisible / Secret Voucher (暗号隐藏)</strong>
                  <p>不在购物车列表中展示卡片，顾客必须在输入框手动输入优惠码。</p>
                </div>
              </label>
            </div>
          </div>

          {/* Usage Limit Toggle */}
          <div className={styles.configBlock}>
            <label className={styles.configHeader}>⚡ Usage Limit (使用次数规则)</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="usage_limit"
                  value="once_total"
                  checked={formData.usage_limit === 'once_total'}
                  onChange={handleInputChange}
                />
                <div>
                  <strong>⚡ Single-Use Only (1 Time Total - 仅用 1 次)</strong>
                  <p>全店仅限使用 1 次，一旦下单成功立即核销失效（专属个人优惠券最常用）。</p>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="usage_limit"
                  value="once_per_customer"
                  checked={formData.usage_limit === 'once_per_customer'}
                  onChange={handleInputChange}
                />
                <div>
                  <strong>👤 Once Per Customer (每位顾客仅限 1 次)</strong>
                  <p>每位已注册顾客只能使用 1 次，适合全店新人优惠等。</p>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="usage_limit"
                  value="unlimited"
                  checked={formData.usage_limit === 'unlimited'}
                  onChange={handleInputChange}
                />
                <div>
                  <strong>♾️ Unlimited Uses (无限次使用)</strong>
                  <p>有效期内任意顾客可反复使用。</p>
                </div>
              </label>
            </div>
          </div>

          {/* Active Status */}
          <div className="formGroup mb3">
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleInputChange}
              />
              <span>Voucher is active and ready to be used</span>
            </label>
          </div>

          <div className="flex gap1">
            <button
              type="button"
              className="btn btnSecondary"
              style={{ flex: 1 }}
              onClick={() => setIsModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btnPrimary"
              style={{ flex: 2, fontWeight: 700 }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Saving...' : (editingVoucher ? 'Update Voucher' : 'Create Voucher')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
