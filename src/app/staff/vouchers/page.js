'use client';

import { useState, useEffect, useCallback } from 'react';
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
    usage_limit: 'unlimited', // 'unlimited' | 'once_total' | 'once_per_customer' | 'monthly_per_customer' | 'monthly_total'
    monthly_limit: 1,
    target_type: 'all', // 'all' | 'specific_customer'
    customer_email: '',
    customer_name: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  const fetchVouchers = useCallback(async () => {
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
  }, [authFetch, toast]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await authFetch('/api/customers');
      const data = await res.json();
      if (res.ok && data.customers) {
        setCustomers(data.customers);
      }
    } catch (e) {
      console.error('Error fetching customers:', e);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchVouchers();
    fetchCustomers();
  }, [fetchVouchers, fetchCustomers]);

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
      monthly_limit: voucher.monthly_limit || 1,
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
      toast.error('请选择或输入接收优惠券的顾客邮箱');
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
        toast.success(editingVoucher ? '优惠券已更新' : '优惠券已成功创建');
        setIsModalOpen(false);
        fetchVouchers();
      } else {
        toast.error(data.error || '保存优惠券失败');
      }
    } catch (error) {
      toast.error('操作出错');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除此优惠券吗？')) return;

    try {
      const res = await authFetch(`/api/vouchers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('优惠券已成功删除');
        fetchVouchers();
      } else {
        toast.error('删除优惠券失败');
      }
    } catch (error) {
      toast.error('操作出错');
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
        toast.success(voucher.active === 1 ? '优惠券已停用' : '优惠券已启用');
        fetchVouchers();
      }
    } catch (error) {
      toast.error('更新状态失败');
    }
  };

  const handleResetUsage = async (voucher) => {
    if (!confirm(`确定要重置优惠券【${voucher.code}】的使用记录吗？\n这会将已使用次数清零，并允许之前使用过的顾客重新使用此优惠券。`)) {
      return;
    }
    try {
      const res = await authFetch(`/api/vouchers/${voucher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_usage: true })
      });

      if (res.ok) {
        toast.success(`优惠券【${voucher.code}】使用记录已清空重置`);
        fetchVouchers();
      } else {
        toast.error('重置使用记录失败');
      }
    } catch (e) {
      toast.error('重置使用记录出错');
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
          <h1 className={styles.title}>优惠券与促销代码管理</h1>
          <p className={styles.subtitle}>创建公开通用的全员优惠券，或为特定顾客发放专属一次性优惠补偿。</p>
        </div>
        <button onClick={openAddModal} className="btn btnPrimary" style={{ fontWeight: 600 }}>
          + 创建新优惠券
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
                  <th>优惠码</th>
                  <th>折扣力度</th>
                  <th>发放对象</th>
                  <th>最低消费</th>
                  <th>购物车展示</th>
                  <th>使用次数规则</th>
                  <th>有效截止日期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="textCenter" style={{ padding: '30px', color: 'var(--color-text-light)' }}>
                      暂无优惠券记录
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
                            ? `${voucher.discount_value}% 优惠`
                            : `RM${Number(voucher.discount_value).toFixed(2)} 立减`}
                        </td>

                        {/* Recipient / Target */}
                        <td>
                          {isSpecific ? (
                            <span
                              className={styles.badgeTargetCustomer}
                              title={`专属顾客: ${voucher.customer_name ? `${voucher.customer_name} (${voucher.customer_email})` : voucher.customer_email}`}
                            >
                              👤 {voucher.customer_name || voucher.customer_email}
                            </span>
                          ) : (
                            <span className={styles.badgeTargetAll} title="全部顾客均可使用">
                              🌐 全体顾客
                            </span>
                          )}
                        </td>

                        <td>RM{Number(voucher.min_order || 0).toFixed(2)}</td>

                        {/* Cart Visibility */}
                        <td>
                          {isPublic ? (
                            <span className={styles.badgeVisible} title={isSpecific ? "仅该顾客登录后在购物车可见" : "所有顾客在购物车均可见"}>
                              👁️ 购物车可见 {isSpecific && '(专属)'}
                            </span>
                          ) : (
                            <span className={styles.badgeHidden} title="购物车不展示卡片，顾客需手动输入优惠码">
                              🔒 暗号隐藏
                            </span>
                          )}
                        </td>

                        {/* Usage Limit */}
                        <td>
                          {usageLimit === 'once_total' ? (
                            <span className={styles.badgeSingleUse} title="全店仅限使用 1 次">
                              ⚡ 限用 1 次 ({timesUsed}/1)
                            </span>
                          ) : usageLimit === 'once_per_customer' ? (
                            <span className={styles.badgeOnceUser} title="每位顾客终生限用 1 次">
                              👤 每人 1 次 (已用 {timesUsed} 次)
                            </span>
                          ) : usageLimit === 'monthly_per_customer' ? (
                            <span className={styles.badgeOnceUser} style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' }} title={`每位顾客每月限用 ${voucher.monthly_limit || 1} 次`}>
                              📅 每人每月 {voucher.monthly_limit || 1} 次 (已用 {timesUsed} 次)
                            </span>
                          ) : usageLimit === 'monthly_total' ? (
                            <span className={styles.badgeSingleUse} style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }} title={`全店每月限用 ${voucher.monthly_limit || 1} 次`}>
                              🏪 全店每月 {voucher.monthly_limit || 1} 次 (已用 {timesUsed} 次)
                            </span>
                          ) : (
                            <span className={styles.badgeUnlimited} title="无限次反复使用">
                              ♾️ 无限次 (已用 {timesUsed} 次)
                            </span>
                          )}
                        </td>

                        <td>
                          {voucher.expiry_date ? (
                            <span className={expired ? styles.textError : ''}>
                              {new Date(voucher.expiry_date).toLocaleDateString()}
                              {expired && ' (已过期)'}
                            </span>
                          ) : '长期有效'}
                        </td>
                        <td>
                          <button
                            className={`${styles.statusToggle} ${voucher.active ? styles.statusActive : styles.statusInactive}`}
                            onClick={() => toggleStatus(voucher)}
                            title="点击切换启用状态"
                          >
                            {voucher.active ? '已启用' : '已停用'}
                          </button>
                        </td>
                        <td>
                          <div className="flex gap1" style={{ flexWrap: 'wrap' }}>
                            <button onClick={() => openEditModal(voucher)} className="btn btnSecondary" style={{ padding: '6px 12px' }}>编辑</button>
                            {(timesUsed > 0 || (Array.isArray(voucher.used_by) && voucher.used_by.length > 0)) && (
                              <button
                                onClick={() => handleResetUsage(voucher)}
                                className="btn"
                                style={{ padding: '6px 10px', fontSize: '0.78rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                                title="清空已使用记录与顾客名单"
                              >
                                🔄 重置使用
                              </button>
                            )}
                            <button onClick={() => handleDelete(voucher.id)} className="btn btnDanger" style={{ padding: '6px 12px' }}>删除</button>
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
        title={editingVoucher ? '编辑优惠券' : '创建新优惠券'}
        maxWidth="680px"
      >
        <form onSubmit={handleSubmit} className={styles.form}>

          <div className="formGroup mb2">
            <label htmlFor="code">优惠券代码 (Voucher Code) *</label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="例如：SPECIAL-FOR-YOU, WELCOME10"
              required
              style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '1px' }}
            />
          </div>

          <div className={styles.grid2}>
            <div className="formGroup mb2">
              <label htmlFor="discount_type">折扣类型 *</label>
              <select
                id="discount_type"
                name="discount_type"
                value={formData.discount_type}
                onChange={handleInputChange}
              >
                <option value="percentage">百分比折扣 (%)</option>
                <option value="fixed">固定立减金额 (RM)</option>
              </select>
            </div>

            <div className="formGroup mb2">
              <label htmlFor="discount_value">
                折扣数值 *
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
              <label htmlFor="min_order">最低消费门槛 (RM) *</label>
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
              <label htmlFor="expiry_date">有效截止日期 (选填，留空为长期有效)</label>
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
            <label className={styles.configHeader}>🎯 发放对象</label>
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
                  <strong>🌐 全体顾客公开</strong>
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
                  <strong>👤 指定专属顾客 (仅该顾客可见且可用)</strong>
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
                        {c.name || '顾客'} ({c.email}) {c.phone ? `- ${c.phone}` : ''}
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
            <label className={styles.configHeader}>🛒 购物车展示规则</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="is_public"
                  checked={formData.is_public === true}
                  onChange={() => setFormData(prev => ({ ...prev, is_public: true }))}
                />
                <div>
                  <strong>👁️ 在购物车直接展示卡片</strong>
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
                  <strong>🔒 暗号隐藏 (不展示卡片，须手动输入优惠码)</strong>
                  <p>不在购物车列表中展示卡片，顾客必须在输入框手动输入优惠码。</p>
                </div>
              </label>
            </div>
          </div>

          {/* Usage Limit Toggle */}
          <div className={styles.configBlock}>
            <label className={styles.configHeader}>⚡ 使用次数与周期规则</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="usage_limit"
                  value="unlimited"
                  checked={formData.usage_limit === 'unlimited'}
                  onChange={handleInputChange}
                />
                <div>
                  <strong>♾️ 无限次反复使用</strong>
                  <p>有效期内任意顾客可反复使用，无次数限制。</p>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="usage_limit"
                  value="monthly_per_customer"
                  checked={formData.usage_limit === 'monthly_per_customer'}
                  onChange={handleInputChange}
                />
                <div>
                  <strong>📅 每位顾客每月限用 N 次 (推荐月度福利券)</strong>
                  <p>限制每位顾客每个自然月内最多使用指定次数，次月 1 日自动重新恢复使用额度。</p>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="usage_limit"
                  value="monthly_total"
                  checked={formData.usage_limit === 'monthly_total'}
                  onChange={handleInputChange}
                />
                <div>
                  <strong>🏪 全店每月总限用 N 次 (月度限量抢券)</strong>
                  <p>全店所有顾客每月共享指定使用总次数配额，当月达到上限后暂停核销，次月 1 日重置。</p>
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
                  <strong>👤 每位顾客终生限用 1 次</strong>
                  <p>每位顾客账户终生只可使用 1 次（如新人首单礼券）。</p>
                </div>
              </label>

              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="usage_limit"
                  value="once_total"
                  checked={formData.usage_limit === 'once_total'}
                  onChange={handleInputChange}
                />
                <div>
                  <strong>⚡ 全店仅限使用 1 次 (单次核销)</strong>
                  <p>全店仅限使用 1 次，一旦下单成功立即核销失效（专属个人单次补偿最常用）。</p>
                </div>
              </label>
            </div>

            {(formData.usage_limit === 'monthly_per_customer' || formData.usage_limit === 'monthly_total') && (
              <div style={{ marginTop: '12px', padding: '14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <label htmlFor="monthly_limit" style={{ fontWeight: 700, display: 'block', marginBottom: '6px', color: '#166534', fontSize: '0.9rem' }}>
                  每月使用上限次数 (次/月) *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    id="monthly_limit"
                    name="monthly_limit"
                    min="1"
                    max="10000"
                    step="1"
                    value={formData.monthly_limit || 1}
                    onChange={handleInputChange}
                    style={{ width: '110px', padding: '8px 12px', fontWeight: 700, fontSize: '1rem', borderRadius: '6px', border: '1px solid #86efac' }}
                    required
                  />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#15803d' }}>
                    {formData.usage_limit === 'monthly_per_customer'
                      ? '次 / 位顾客 / 每个自然月'
                      : '次 / 全店总额度 / 每个自然月'}
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#166534', lineHeight: 1.4 }}>
                  {formData.usage_limit === 'monthly_per_customer'
                    ? '例如设置为 1，则每位顾客本月只能使用 1 次，当下月 1 日到来时，该顾客又可以再次使用 1 次。'
                    : '例如设置为 50，则本月全店一共只能被使用 50 次，下月 1 日自动重新开放 50 次额度。'}
                </p>
              </div>
            )}
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
              <span>优惠券当前处于启用状态，可正常核销</span>
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
              取消
            </button>
            <button
              type="submit"
              className="btn btnPrimary"
              style={{ flex: 2, fontWeight: 700 }}
              disabled={actionLoading}
            >
              {actionLoading ? '保存中...' : (editingVoucher ? '更新优惠券' : '确认创建')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
