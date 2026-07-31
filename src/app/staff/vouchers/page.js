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
    active: true
  };
  
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/vouchers');
      const data = await res.json();
      if (res.ok) {
        setVouchers(data.vouchers);
      }
    } catch (error) {
      toast.error('Failed to load vouchers');
    } finally {
      setLoading(false);
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
      active: voucher.active === 1
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
    setActionLoading(true);
    
    try {
      const url = editingVoucher 
        ? `/api/vouchers/${editingVoucher.id}` 
        : '/api/vouchers';
      
      const method = editingVoucher ? 'PUT' : 'POST';
      
      // format data
      const payload = { ...formData };
      if (!payload.expiry_date) payload.expiry_date = null;
      
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
        <h1 className={styles.title}>Vouchers & Discounts</h1>
        <button onClick={openAddModal} className="btn btnPrimary">+ Create Voucher</button>
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
                  <th>Min Order</th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="textCenter">No vouchers found</td>
                  </tr>
                ) : (
                  vouchers.map(voucher => {
                    const expired = isExpired(voucher.expiry_date);
                    
                    return (
                      <tr key={voucher.id} className={!voucher.active || expired ? styles.inactiveRow : ''}>
                        <td className={styles.codeCell}>{voucher.code}</td>
                        <td className={styles.discountCell}>
                          {voucher.discount_type === 'percentage' 
                            ? `${voucher.discount_value}% OFF`
                            : `RM${voucher.discount_value.toFixed(2)} OFF`}
                        </td>
                        <td>RM{voucher.min_order.toFixed(2)}</td>
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
              placeholder="e.g. WELCOME10"
              required 
              style={{ textTransform: 'uppercase' }}
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
            <div className="formGroup mb3">
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
            
            <div className="formGroup mb3">
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

          <div className="formGroup mb3">
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                name="active" 
                checked={formData.active} 
                onChange={handleInputChange} 
              />
              <span>Voucher is active and can be used by customers</span>
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
              style={{ flex: 2 }}
              disabled={actionLoading}
            >
              {actionLoading ? 'Saving...' : 'Save Voucher'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
