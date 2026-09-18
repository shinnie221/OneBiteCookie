'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { businessDate, money } from '@/lib/business.mjs';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import styles from './page.module.css';

export const GOOGLE_DRIVE_RECEIPTS_URL = 'https://drive.google.com/drive/folders/1CxUKoiIQ5oicc6Eo-vun2pC0-2mG0joh?usp=sharing';

const CATEGORIES = [
  { id: '食材', label: '食材原料 (面粉/黄油/糖/蛋/辅料)', badgeClass: styles.badgeIngredient },
  { id: '包装', label: '包装耗材 (铁盒/纸盒/胶带/贴纸)', badgeClass: styles.badgePackage },
  { id: '厨房租金', label: '厨房租金 / 水电燃气', badgeClass: styles.badgeKitchen },
  { id: '兼职人工费', label: '兼职人工费', badgeClass: styles.badgeOther },
  { id: '配送相关', label: '配送耗材 / 运费', badgeClass: styles.badgeOther },
  { id: '广告物料', label: '广告 / 物料制作', badgeClass: styles.badgeOther },
  { id: '其他', label: '其他日常杂支', badgeClass: styles.badgeOther },
];

export default function ExpensesPage() {
  const { authFetch } = useAuth();
  const toast = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(() => businessDate().slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    date: businessDate(),
    category: '食材',
    amount: '',
    note: '',
    supplierName: '',
    receiptUrl: ''
  });

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/finance');
      if (!res.ok) throw new Error('无法加载成本支出记录');
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      toast.error(err.message || '加载成本支出记录失败');
    } finally {
      setLoading(false);
    }
  }, [authFetch, toast]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Only show expense transactions (支出)
      if (record.transactionType && record.transactionType !== '支出') return false;

      // Month filter
      if (selectedMonth && !record.date?.startsWith(selectedMonth)) return false;

      // Category filter
      if (selectedCategory !== 'all' && record.category !== selectedCategory) return false;

      // Search query (note or supplier)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const noteMatch = (record.note || '').toLowerCase().includes(query);
        const supplierMatch = (record.supplierName || '').toLowerCase().includes(query);
        if (!noteMatch && !supplierMatch) return false;
      }

      return true;
    });
  }, [records, selectedMonth, selectedCategory, searchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    let total = 0;
    let ingredients = 0;
    let packaging = 0;
    let withReceipt = 0;

    for (const r of filteredRecords) {
      const amt = Number(r.amount) || 0;
      total += amt;
      if (r.category === '食材') ingredients += amt;
      else if (r.category === '包装') packaging += amt;

      if (r.receiptUrl && r.receiptUrl.trim()) {
        withReceipt++;
      }
    }

    return {
      total,
      ingredients,
      packaging,
      other: Math.max(0, total - ingredients - packaging),
      count: filteredRecords.length,
      withReceipt
    };
  }, [filteredRecords]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      date: businessDate(),
      category: '食材',
      amount: '',
      note: '',
      supplierName: '',
      receiptUrl: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    setFormData({
      date: record.date || businessDate(),
      category: record.category || '食材',
      amount: record.amount ? String(record.amount) : '',
      note: record.note || '',
      supplierName: record.supplierName || '',
      receiptUrl: record.receiptUrl || ''
    });
    setIsModalOpen(true);
  };

  // Submit Form (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.date) {
      toast.error('请选择支出日期');
      return;
    }
    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('请输入有效的支出金额');
      return;
    }
    if (!formData.note.trim()) {
      toast.error('请输入支出品项或原料说明（如：特级高筋面粉 50kg）');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        date: formData.date,
        transactionType: '支出',
        category: formData.category,
        amount: numAmount,
        note: formData.note.trim(),
        supplierName: formData.supplierName.trim(),
        receiptUrl: formData.receiptUrl.trim(),
        orderType: 'General'
      };

      let res;
      if (editingRecord) {
        res = await authFetch(`/api/finance/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await authFetch('/api/finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存支出记录失败');

      toast.success(editingRecord ? '支出记录已成功更新' : '成本支出记录已录入');
      setIsModalOpen(false);
      loadExpenses();
    } catch (err) {
      toast.error(err.message || '保存记录出错');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Record
  const handleDelete = async (id, note) => {
    if (!confirm(`确定要删除「${note || '此笔支出'}」吗？此操作无法撤销。`)) return;

    try {
      const res = await authFetch(`/api/finance/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除支出记录失败');
      toast.success('支出记录已删除');
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toast.error(err.message || '删除出错');
    }
  };

  const getBadgeClass = (category) => {
    const found = CATEGORIES.find(c => c.id === category);
    return found ? found.badgeClass : styles.badgeOther;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>成本与采购核算</p>
          <h1 className={styles.headerTitle}>原材料与日常成本支出</h1>
          <p className={styles.subtitle}>
            专用于记录面粉、黄油等烘焙原料、包装耗材及日常运营开销。支持附带 Google Drive 收据凭证链接，并自动计入流水账本及净营业额扣减。
          </p>
        </div>
        <div className={styles.headerActions}>
          <a
            href={GOOGLE_DRIVE_RECEIPTS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.driveFolderBtn}
            title="在 Google Drive 中打开共享收据文件夹"
          >
            📂 打开 Google Drive 收据文件夹 ↗
          </a>
          <button className="btn btnPrimary" onClick={handleOpenAdd}>
            + 录入新成本支出
          </button>
        </div>
      </header>

      {/* KPI Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>本期总成本支出</span>
          <strong className={styles.statValue}>{money(stats.total)}</strong>
          <span className={styles.statSubtext}>共 {stats.count} 笔支出</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>烘焙原料成本 (面粉/黄油等)</span>
          <strong className={styles.statValue} style={{ color: '#c2410c' }}>{money(stats.ingredients)}</strong>
          <span className={styles.statSubtext}>食材原料主项采购</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>包材及其他杂费</span>
          <strong className={styles.statValue} style={{ color: '#15803d' }}>{money(stats.packaging + stats.other)}</strong>
          <span className={styles.statSubtext}>包材 {money(stats.packaging)} · 杂费 {money(stats.other)}</span>
        </div>
        <a
          href={GOOGLE_DRIVE_RECEIPTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.statCard} ${styles.statCardClickable}`}
          title="点击打开 Google Drive 收据文件夹查看或上传收据"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className={styles.statLabel}>Google Drive 收据库</span>
            <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>打开云盘 ↗</span>
          </div>
          <strong className={styles.statValue} style={{ color: '#1d4ed8' }}>
            📂 共享收据文件夹
          </strong>
          <span className={styles.statSubtext}>随时一键打开上传或查阅收据</span>
        </a>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <input
            type="month"
            className={styles.selectInput}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            title="按月份筛选"
          />
          <select
            className={styles.selectInput}
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="all">全部分类</option>
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="搜索原料名、备注或供应商..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {(selectedCategory !== 'all' || searchQuery || selectedMonth !== businessDate().slice(0, 7)) && (
          <button
            className="btn btnSecondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => {
              setSelectedMonth(businessDate().slice(0, 7));
              setSelectedCategory('all');
              setSearchQuery('');
            }}
          >
            重置筛选
          </button>
        )}
      </div>

      {/* Expenses Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <LoadingSpinner text="正在加载成本支出明细..." />
        ) : filteredRecords.length === 0 ? (
          <div className={styles.emptyState}>
            当前时间段内暂无成本支出记录。点击上方「+ 录入新成本支出」添加第一笔原料采购。
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>支出日期</th>
                  <th>类别</th>
                  <th>原料品项 / 费用说明</th>
                  <th>供应商 / 购买地</th>
                  <th>支出金额</th>
                  <th>Google Drive 发票凭证</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(item => {
                  const hasDrive = Boolean(item.receiptUrl && item.receiptUrl.trim());
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.date}</strong>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${getBadgeClass(item.category)}`}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <strong>{item.note || '未填写'}</strong>
                      </td>
                      <td>
                        {item.supplierName ? (
                          <span>{item.supplierName}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-light)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: '#dc2626' }}>{money(item.amount)}</strong>
                      </td>
                      <td>
                        {hasDrive ? (
                          <a
                            href={item.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.driveBtn}
                            title="打开此单据独立收据凭证"
                          >
                            📄 查看特定收据 ↗
                          </a>
                        ) : (
                          <a
                            href={GOOGLE_DRIVE_RECEIPTS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.driveFolderLink}
                            title="打开团队 Google Drive 收据文件夹"
                          >
                            📂 打开收据云盘 ↗
                          </a>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          <button
                            className={styles.btnEdit}
                            onClick={() => handleOpenEdit(item)}
                          >
                            编辑
                          </button>
                          <button
                            className={styles.btnDelete}
                            onClick={() => handleDelete(item.id, item.note)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRecord ? '编辑成本支出记录' : '录入成本支出 (面粉/黄油/原料耗材)'}
        maxWidth="560px"
      >
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {/* Shared Google Drive Folder Banner */}
          <div className={styles.driveFolderBanner}>
            <div className={styles.driveFolderInfo}>
              <span style={{ fontSize: '1.25rem' }}>📂</span>
              <div>
                <strong style={{ fontSize: '0.88rem', color: '#166534' }}>Google Drive 收据文件夹已关联</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#15803d', lineHeight: '1.4' }}>
                  日常采购收据/发票可直接放进团队共享云盘，无需每次逐笔输入链接！
                </p>
              </div>
            </div>
            <a
              href={GOOGLE_DRIVE_RECEIPTS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.driveOpenLink}
              title="在 Google Drive 中打开团队收据文件夹"
            >
              打开云盘 ↗
            </a>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>支出日期 *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className={styles.formField}>
              <label>支出类别 *</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>支出金额 (RM) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="例如: 240.00"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className={styles.formField}>
              <label>供应商 / 采购商行</label>
              <input
                type="text"
                placeholder="例如: Bake With Yen / Sheng Siong"
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formField}>
            <label>原料品项与规格说明 *</label>
            <input
              type="text"
              required
              placeholder="例如: Anchor 动物黄油 10 箱 / 顶级高筋面粉 50kg"
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
            />
            <span className={styles.fieldHint}>填写采购的具体商品品类、规格、重量或批次说明</span>
          </div>

          <div className={styles.formField}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ margin: 0 }}>特定文件链接 (选填)</label>
              <a
                href={GOOGLE_DRIVE_RECEIPTS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.78rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
              >
                打开云盘文件夹 ↗
              </a>
            </div>
            <input
              type="url"
              placeholder="留空即默认统一通过云盘查阅；如有特定发票文件链接可贴在此处"
              value={formData.receiptUrl}
              onChange={e => setFormData({ ...formData, receiptUrl: e.target.value })}
            />
            <span className={styles.fieldHint}>
              💡 提示：无需每次都输入链接，收据统一上传到共享云盘即可随时点击查看。
            </span>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className="btn btnSecondary"
              onClick={() => setIsModalOpen(false)}
              disabled={actionLoading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btnPrimary"
              disabled={actionLoading}
            >
              {actionLoading ? '保存中...' : (editingRecord ? '保存修改' : '确认录入支出')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
