'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useToast } from '@/context/ToastContext';
import styles from './page.module.css';

const CATEGORIES = [
  '食材',
  '包装',
  '厨房租金',
  '摊位费',
  '兼职人工费',
  '配送相关',
  '广告物料',
  '样品/试吃损耗',
  '内部个人采购',
  'Supplier采购',
  '其他'
];

const ORDER_TYPES = ['Pre-order', 'Booth', 'General'];

export default function FinancePage() {
  const { authFetch } = useAuth();
  const toast = useToast();

  // Active Tab: 'records' | 'suppliers'
  const [activeTab, setActiveTab] = useState('records');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Filters
  const [filterOrderType, setFilterOrderType] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterMonth, setFilterMonth] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Finance Record Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordForm, setRecordForm] = useState({
    date: new Date().toISOString().split('T')[0],
    transactionType: '支出',
    category: '食材',
    amount: '',
    orderType: 'General',
    note: '',
    receiptUrl: '',
    supplierName: ''
  });
  const [recordSaving, setRecordSaving] = useState(false);

  // Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact: '',
    notes: '',
    status: '合作中',
    minOrderQty: 40,
    standardSupplyPrice: 4.80,
    bulkThresholdQty: 100,
    bulkSupplyPrice: 4.40
  });
  const [supplierSaving, setSupplierSaving] = useState(false);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isRecordModalOpen || isSupplierModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isRecordModalOpen, isSupplierModalOpen]);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRecords(), fetchSuppliers()]);
    } catch (err) {
      console.error('Error loading finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      const res = await authFetch('/api/finance');
      const data = await res.json();
      if (res.ok) {
        setRecords(data.records || []);
      }
    } catch (err) {
      toast.error('Failed to load financial records');
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await authFetch('/api/suppliers');
      const data = await res.json();
      if (res.ok) {
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      toast.error('Failed to load suppliers');
    }
  };

  // ----------------------------------------------------
  // Statistics Calculations (Strict rules based on requirements)
  // ----------------------------------------------------
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const stats = useMemo(() => {
    let preOrderRevenue = 0;
    let boothRevenue = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    let monthlySampleLoss = 0;
    let monthlySupplierExpense = 0;
    let monthlySupplierIncome = 0;

    records.forEach(r => {
      const amt = parseFloat(r.amount) || 0;
      const rDate = r.date || '';
      const isCurrentMonth = rDate.startsWith(currentMonthStr);

      // Total Income & Expense
      if (r.transactionType === '收入') {
        totalIncome += amt;
        // 1. Pre-order revenue (only income + Pre-order)
        if (r.orderType === 'Pre-order') {
          preOrderRevenue += amt;
        }
        // 2. Booth revenue (only income + Booth)
        if (r.orderType === 'Booth') {
          boothRevenue += amt;
        }
        // 8. This month supplier sales revenue (income + category === 'Supplier采购')
        if (isCurrentMonth && r.category === 'Supplier采购') {
          monthlySupplierIncome += amt;
        }
      } else if (r.transactionType === '支出') {
        totalExpense += amt;

        // 6. This month sample loss (expense + category === '样品/试吃损耗')
        if (isCurrentMonth && r.category === '样品/试吃损耗') {
          monthlySampleLoss += amt;
        }

        // 7. This month supplier procurement expense (expense + category === 'Supplier采购')
        if (isCurrentMonth && r.category === 'Supplier采购') {
          monthlySupplierExpense += amt;
        }
      }
    });

    const netProfit = totalIncome - totalExpense;

    return {
      preOrderRevenue,
      boothRevenue,
      totalIncome,
      totalExpense,
      netProfit,
      monthlySampleLoss,
      monthlySupplierExpense,
      monthlySupplierIncome
    };
  }, [records, currentMonthStr]);

  // Filtered records for display
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (filterOrderType !== 'all' && r.orderType !== filterOrderType) return false;
      if (filterSupplier !== 'all' && (r.supplierName || '') !== filterSupplier) return false;
      if (filterMonth && !(r.date || '').startsWith(filterMonth)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchNote = (r.note || '').toLowerCase().includes(query);
        const matchCategory = (r.category || '').toLowerCase().includes(query);
        const matchSupplier = (r.supplierName || '').toLowerCase().includes(query);
        if (!matchNote && !matchCategory && !matchSupplier) return false;
      }
      return true;
    });
  }, [records, filterOrderType, filterSupplier, filterMonth, searchQuery]);

  // Unique supplier names for dropdown filter
  const existingSupplierNames = useMemo(() => {
    const names = new Set();
    suppliers.forEach(s => {
      if (s.name) names.add(s.name.trim());
    });
    records.forEach(r => {
      if (r.supplierName) names.add(r.supplierName.trim());
    });
    return Array.from(names).sort();
  }, [suppliers, records]);

  // ----------------------------------------------------
  // Financial Record Actions
  // ----------------------------------------------------
  const handleOpenCreateRecord = () => {
    setEditingRecord(null);
    setRecordForm({
      date: new Date().toISOString().split('T')[0],
      transactionType: '支出',
      category: '食材',
      amount: '',
      orderType: 'General',
      note: '',
      receiptUrl: '',
      supplierName: ''
    });
    setIsRecordModalOpen(true);
  };

  const handleOpenEditRecord = (record) => {
    setEditingRecord(record);
    setRecordForm({
      date: record.date || new Date().toISOString().split('T')[0],
      transactionType: record.transactionType || '支出',
      category: record.category || '食材',
      amount: record.amount ?? '',
      orderType: record.orderType || 'General',
      note: record.note || '',
      receiptUrl: record.receiptUrl || '',
      supplierName: record.supplierName || ''
    });
    setIsRecordModalOpen(true);
  };

  const handleCategoryChange = (e) => {
    const selectedCategory = e.target.value;
    let newTransactionType = recordForm.transactionType;
    let newOrderType = recordForm.orderType;

    // Rule: if category === '样品/试吃损耗', force transactionType to '支出'
    if (selectedCategory === '样品/试吃损耗') {
      newTransactionType = '支出';
    }

    // Recommended default for '内部个人采购' -> typically '收入'
    if (selectedCategory === '内部个人采购' && recordForm.transactionType !== '收入') {
      newTransactionType = '收入';
    }

    // Recommended orderType for 'Supplier采购'
    if (selectedCategory === 'Supplier采购') {
      newOrderType = 'General';
    }

    setRecordForm(prev => ({
      ...prev,
      category: selectedCategory,
      transactionType: newTransactionType,
      orderType: newOrderType
    }));
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    if (!recordForm.date) {
      toast.error('Please select a date');
      return;
    }

    const amt = parseFloat(recordForm.amount);
    if (isNaN(amt) || amt < 0) {
      toast.error('Amount must be a non-negative number');
      return;
    }

    setRecordSaving(true);
    try {
      const payload = {
        ...recordForm,
        amount: amt
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

      if (res.ok) {
        toast.success(editingRecord ? 'Record updated' : 'Record added successfully');
        setIsRecordModalOpen(false);
        fetchRecords();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save record');
      }
    } catch (err) {
      toast.error('Error saving record');
    } finally {
      setRecordSaving(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!confirm('Are you sure you want to delete this financial record?')) return;
    try {
      const res = await authFetch(`/api/finance/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Record deleted');
        fetchRecords();
      } else {
        toast.error('Failed to delete record');
      }
    } catch (err) {
      toast.error('Error deleting record');
    }
  };

  // ----------------------------------------------------
  // Supplier Actions
  // ----------------------------------------------------
  const handleOpenCreateSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      contact: '',
      notes: '',
      status: '合作中',
      minOrderQty: 40,
      standardSupplyPrice: 4.80,
      bulkThresholdQty: 100,
      bulkSupplyPrice: 4.40
    });
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name || '',
      contact: supplier.contact || '',
      notes: supplier.notes || '',
      status: supplier.status || '合作中',
      minOrderQty: supplier.minOrderQty ?? 40,
      standardSupplyPrice: supplier.standardSupplyPrice ?? 4.80,
      bulkThresholdQty: supplier.bulkThresholdQty ?? 100,
      bulkSupplyPrice: supplier.bulkSupplyPrice ?? 4.40
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    setSupplierSaving(true);
    try {
      let res;
      if (editingSupplier) {
        res = await authFetch(`/api/suppliers/${editingSupplier.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(supplierForm)
        });
      } else {
        res = await authFetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(supplierForm)
        });
      }

      if (res.ok) {
        toast.success(editingSupplier ? 'Supplier updated' : 'Supplier created');
        setIsSupplierModalOpen(false);
        fetchSuppliers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save supplier');
      }
    } catch (err) {
      toast.error('Error saving supplier');
    } finally {
      setSupplierSaving(false);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!confirm('Are you sure you want to delete this supplier profile?')) return;
    try {
      const res = await authFetch(`/api/suppliers/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Supplier deleted');
        fetchSuppliers();
      } else {
        toast.error('Failed to delete supplier');
      }
    } catch (err) {
      toast.error('Error deleting supplier');
    }
  };

  // ----------------------------------------------------
  // Export CSV Feature (Google Sheet compatible)
  // ----------------------------------------------------
  const handleExportCSV = () => {
    if (records.length === 0) {
      toast.error('No financial records to export');
      return;
    }

    const headers = [
      '日期 (Date)',
      '收支类型 (Type)',
      '费用分类 (Category)',
      '订单业务类型 (Order Type)',
      '金额 (Amount RM)',
      '供应商/合作店铺 (Supplier)',
      '备注 (Notes)',
      '收据凭证链接 (Receipt URL)',
      '录入时间 (Created At)'
    ];

    const rows = filteredRecords.map(r => [
      `"${r.date || ''}"`,
      `"${r.transactionType || ''}"`,
      `"${r.category || ''}"`,
      `"${r.orderType || ''}"`,
      `"${parseFloat(r.amount || 0).toFixed(2)}"`,
      `"${(r.supplierName || '').replace(/"/g, '""')}"`,
      `"${(r.note || '').replace(/"/g, '""')}"`,
      `"${(r.receiptUrl || '').replace(/"/g, '""')}"`,
      `"${r.created_at ? new Date(r.created_at).toLocaleString() : ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OneBite_Finance_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully');
  };

  if (loading) {
    return <LoadingSpinner text="Loading financial records & supplier data..." />;
  }

  return (
    <div className={styles.container}>
      {/* Top Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Finance & Suppliers</h1>
          <p className={styles.subtitle}>Manage business finances, wholesale supplier pricing, and revenue accounts</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'records' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <span>📑</span> 财务账目 (Financial Records)
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'suppliers' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          <span>🏢</span> 供应商管理 (Suppliers & Pricing)
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: 财务账目 & 统计看板                                     */}
      {/* ============================================================ */}
      {activeTab === 'records' && (
        <div>
          {/* Statistics Dashboard */}
          <div className={styles.statsGrid}>
            {/* 1. Pre-order 营收汇总 */}
            <div className={`${styles.statCard} ${styles.statPreorder}`}>
              <div className={styles.statIcon}>🌐</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Pre-order 线上预购营收</div>
                <div className={styles.statValue}>RM{stats.preOrderRevenue.toFixed(2)}</div>
                <div className={styles.statSubtext}>仅统计线上销售收入</div>
              </div>
            </div>

            {/* 2. Booth 摆摊营收汇总 */}
            <div className={`${styles.statCard} ${styles.statBooth}`}>
              <div className={styles.statIcon}>🎪</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Booth 摆摊销售营收</div>
                <div className={styles.statValue}>RM{stats.boothRevenue.toFixed(2)}</div>
                <div className={styles.statSubtext}>仅统计摆摊销售收入</div>
              </div>
            </div>

            {/* 3. 总收入 */}
            <div className={`${styles.statCard} ${styles.statIncome}`}>
              <div className={styles.statIcon}>📈</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>全部累计总收入</div>
                <div className={styles.statValue}>RM{stats.totalIncome.toFixed(2)}</div>
                <div className={styles.statSubtext}>所有业务收入总和</div>
              </div>
            </div>

            {/* 4. 总支出 */}
            <div className={`${styles.statCard} ${styles.statExpense}`}>
              <div className={styles.statIcon}>📉</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>全部累计总支出</div>
                <div className={styles.statValue}>RM{stats.totalExpense.toFixed(2)}</div>
                <div className={styles.statSubtext}>食材/租金/物料等成本</div>
              </div>
            </div>

            {/* 5. 当前净利润 */}
            <div className={`${styles.statCard} ${styles.statProfit}`}>
              <div className={styles.statIcon}>💰</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>当前净利润</div>
                <div className={styles.statValue} style={{ color: stats.netProfit >= 0 ? '#059669' : '#dc2626' }}>
                  RM{stats.netProfit.toFixed(2)}
                </div>
                <div className={styles.statSubtext}>总收入 − 总支出</div>
              </div>
            </div>

            {/* 6. 本月样品损耗支出 (Threshold warning at >=45 yellow, >=50 red) */}
            <div className={`${styles.statCard} ${
              stats.monthlySampleLoss >= 50
                ? styles.sampleLossAlert
                : stats.monthlySampleLoss >= 45
                ? styles.sampleLossWarning
                : styles.sampleLossNormal
            }`}>
              <div className={styles.statIcon}>🍪</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>本月样品/试吃损耗</div>
                <div className={styles.statValue}>RM{stats.monthlySampleLoss.toFixed(2)}</div>
                {stats.monthlySampleLoss >= 50 ? (
                  <span className={`${styles.warningBadge} ${styles.warningRed}`}>
                    🚨 已超出月度样品上限 (上限 RM50)
                  </span>
                ) : stats.monthlySampleLoss >= 45 ? (
                  <span className={`${styles.warningBadge} ${styles.warningYellow}`}>
                    ⚠️ 接近月度上限 (上限 RM50)
                  </span>
                ) : (
                  <div className={styles.statSubtext}>上限额度 RM50.00</div>
                )}
              </div>
            </div>

            {/* 7. 本月 Supplier 采购总支出 */}
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🛒</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>本月 Supplier 采购总支出</div>
                <div className={styles.statValue} style={{ color: '#ea580c' }}>
                  RM{stats.monthlySupplierExpense.toFixed(2)}
                </div>
                <div className={styles.statSubtext}>我方向供应商进货花费</div>
              </div>
            </div>

            {/* 8. 本月供货给供应商店铺总收入 */}
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🤝</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>本月合作店铺供货收入</div>
                <div className={styles.statValue} style={{ color: '#0284c7' }}>
                  RM{stats.monthlySupplierIncome.toFixed(2)}
                </div>
                <div className={styles.statSubtext}>我方供货给外部店铺收入</div>
              </div>
            </div>
          </div>

          {/* Filters & Action Bar */}
          <div className={styles.toolbar}>
            <div className={styles.filterGroup}>
              <div className={styles.filterItem}>
                <label>业务类型:</label>
                <select
                  value={filterOrderType}
                  onChange={e => setFilterOrderType(e.target.value)}
                  className={styles.select}
                >
                  <option value="all">全部业务类型</option>
                  <option value="Pre-order">Pre-order 线上预购</option>
                  <option value="Booth">Booth 摆摊业务</option>
                  <option value="General">General 通用杂项</option>
                </select>
              </div>

              <div className={styles.filterItem}>
                <label>供应商/合作店铺:</label>
                <select
                  value={filterSupplier}
                  onChange={e => setFilterSupplier(e.target.value)}
                  className={styles.select}
                >
                  <option value="all">全部供应商</option>
                  {existingSupplierNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.filterItem}>
                <label>月份:</label>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className={styles.input}
                />
                {filterMonth && (
                  <button
                    className="btn btnSecondary"
                    style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                    onClick={() => setFilterMonth('')}
                  >
                    清除
                  </button>
                )}
              </div>

              <div className={styles.filterItem}>
                <input
                  type="text"
                  placeholder="搜索备注/类别/供应商..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={styles.input}
                  style={{ minWidth: '180px' }}
                />
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button onClick={handleExportCSV} className={styles.btnExport}>
                <span>📥</span> 导出 CSV (Google Sheets)
              </button>
              <button onClick={handleOpenCreateRecord} className={styles.btnCreate}>
                <span>➕</span> 记一笔账
              </button>
            </div>
          </div>

          {/* Records Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>收支类型</th>
                  <th>费用类别</th>
                  <th>业务类型</th>
                  <th>金额 (RM)</th>
                  <th>供应商 / 合作店铺</th>
                  <th>备注</th>
                  <th>收据凭证</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📝</div>
                        <p>暂无符合条件的财务记录</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map(record => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${
                          record.transactionType === '收入' ? styles.typeIncome : styles.typeExpense
                        }`}>
                          {record.transactionType === '收入' ? '＋ 收入' : '－ 支出'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.categoryTag}>{record.category}</span>
                      </td>
                      <td>
                        <span className={styles.orderTypeBadge}>{record.orderType}</span>
                      </td>
                      <td>
                        <span className={record.transactionType === '收入' ? styles.amountIncome : styles.amountExpense}>
                          {record.transactionType === '收入' ? '+' : '-'}RM{parseFloat(record.amount || 0).toFixed(2)}
                        </span>
                      </td>
                      <td>{record.supplierName || '—'}</td>
                      <td style={{ maxWidth: '220px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {record.note || '—'}
                      </td>
                      <td>
                        {record.receiptUrl ? (
                          <a
                            href={record.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.receiptBtn}
                            title={record.receiptUrl}
                          >
                            <span>📎</span> 打开收据 ↗
                          </a>
                        ) : (
                          <span className={styles.receiptBtnDisabled}>
                            <span>📎</span> 无收据
                          </span>
                        )}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={styles.btnEditRow}
                            onClick={() => handleOpenEditRecord(record)}
                          >
                            编辑
                          </button>
                          <button
                            className={styles.btnDeleteRow}
                            onClick={() => handleDeleteRecord(record.id)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: 供应商管理 & 曲奇供货定价参考                            */}
      {/* ============================================================ */}
      {activeTab === 'suppliers' && (
        <div>
          {/* Policy Reminder Warning Box */}
          <div className={styles.policyBanner}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong>合作约定：</strong>需要和店铺约定最低零售售价，防止低价倾销冲击自有线上零售；新合作不建议赊账，优先定金+出货结清模式。
            </div>
          </div>

          {/* Supplier Toolbar */}
          <div className={styles.toolbar}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>合作供应商与外部供货店铺档案</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', margin: '4px 0 0' }}>
                共维护 {suppliers.length} 家供应商/合作店铺
              </p>
            </div>
            <div>
              <button onClick={handleOpenCreateSupplier} className={styles.btnCreate}>
                <span>➕</span> 新增供应商档案
              </button>
            </div>
          </div>

          {/* Supplier Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>供应商 / 合作店铺</th>
                  <th>状态</th>
                  <th>联系方式</th>
                  <th>最低起订量</th>
                  <th>标准供货价</th>
                  <th>大批量优惠门槛</th>
                  <th>大批量优惠价</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🏢</div>
                        <p>暂无供应商档案，请点击右上角新增</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  suppliers.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{s.name}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${
                          s.status === '合作中' ? styles.typeIncome : styles.typeExpense
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td>{s.contact || '—'}</td>
                      <td>{s.minOrderQty ? `${s.minOrderQty} pcs` : '40 pcs'}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        RM{parseFloat(s.standardSupplyPrice || 4.80).toFixed(2)}
                      </td>
                      <td>{s.bulkThresholdQty ? `≥${s.bulkThresholdQty} pcs` : '≥100 pcs'}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>
                        RM{parseFloat(s.bulkSupplyPrice || 4.40).toFixed(2)}
                      </td>
                      <td style={{ maxWidth: '180px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {s.notes || '—'}
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={styles.btnEditRow}
                            onClick={() => handleOpenEditSupplier(s)}
                          >
                            编辑
                          </button>
                          <button
                            className={styles.btnDeleteRow}
                            onClick={() => handleDeleteSupplier(s.id)}
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: 记一笔账 (新增 / 编辑财务记录)                            */}
      {/* ============================================================ */}
      {isRecordModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsRecordModalOpen(false)}>
          <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingRecord ? '编辑财务账目' : '新增财务账目'}</h3>
              <button className={styles.modalClose} onClick={() => setIsRecordModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveRecord} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* Notice for 内部个人采购 */}
                {recordForm.category === '内部个人采购' && (
                  <div className={styles.partnerNotice}>
                    💡 该条目为合伙人个人食用补回公款的收入记录。
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>日期 <span className={styles.required}>*</span></label>
                    <input
                      type="date"
                      value={recordForm.date}
                      onChange={e => setRecordForm({ ...recordForm, date: e.target.value })}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>费用分类 (Category) <span className={styles.required}>*</span></label>
                    <select
                      value={recordForm.category}
                      onChange={handleCategoryChange}
                      className={styles.select}
                      required
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>收支类型 (Type) <span className={styles.required}>*</span></label>
                    <select
                      value={recordForm.transactionType}
                      onChange={e => setRecordForm({ ...recordForm, transactionType: e.target.value })}
                      className={styles.select}
                      disabled={recordForm.category === '样品/试吃损耗'}
                    >
                      <option value="支出">支出 (Expense)</option>
                      <option value="收入">收入 (Income)</option>
                    </select>
                    {recordForm.category === '样品/试吃损耗' && (
                      <span className={styles.formHint} style={{ color: '#dc2626' }}>
                        *「样品/试吃损耗」类别限定为支出
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label>金额 (Amount RM) <span className={styles.required}>*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={recordForm.amount}
                      onChange={e => setRecordForm({ ...recordForm, amount: e.target.value })}
                      className={styles.input}
                      required
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>订单业务类型 (Order Type) <span className={styles.required}>*</span></label>
                    <select
                      value={recordForm.orderType}
                      onChange={e => setRecordForm({ ...recordForm, orderType: e.target.value })}
                      className={styles.select}
                    >
                      <option value="General">General (通用杂项/损耗/合作店铺供货收入)</option>
                      <option value="Pre-order">Pre-order (线上预购相关收支)</option>
                      <option value="Booth">Booth (摆摊业务相关收支)</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>供应商 / 合作店铺名称 (可选)</label>
                    <input
                      type="text"
                      list="supplier-suggestions"
                      placeholder="选择或输入供应商/店铺名"
                      value={recordForm.supplierName}
                      onChange={e => setRecordForm({ ...recordForm, supplierName: e.target.value })}
                      className={styles.input}
                    />
                    <datalist id="supplier-suggestions">
                      {existingSupplierNames.map(name => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                    <span className={styles.formHint}>
                      支出填进货供应商，收入填供货合作店铺
                    </span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Google Drive 收据凭证链接 (可选)</label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/..."
                    value={recordForm.receiptUrl}
                    onChange={e => setRecordForm({ ...recordForm, receiptUrl: e.target.value })}
                    className={styles.input}
                  />
                  <span className={styles.formHint}>填写后可在列表一键打开收据图片/PDF</span>
                </div>

                <div className={styles.formGroup}>
                  <label>备注说明 (可选)</label>
                  <textarea
                    rows="3"
                    placeholder="详细明细、合伙人垫付、店铺供货批次等..."
                    value={recordForm.note}
                    onChange={e => setRecordForm({ ...recordForm, note: e.target.value })}
                    className={styles.input}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className="btn btnSecondary"
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={recordSaving}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btnPrimary"
                  disabled={recordSaving}
                >
                  {recordSaving ? '保存中...' : (editingRecord ? '保存修改' : '确认记录')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: 新增 / 编辑供应商档案 + 曲奇供货定价参考算法            */}
      {/* ============================================================ */}
      {isSupplierModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsSupplierModalOpen(false)}>
          <div className={`${styles.modalCard} ${styles.modalCardLarge}`} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingSupplier ? '编辑供应商档案' : '新增供应商档案'}</h3>
              <button className={styles.modalClose} onClick={() => setIsSupplierModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveSupplier} className={styles.modalForm}>
              <div className={styles.modalBody}>
                {/* Form Inputs */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>供应商 / 合作店铺名称 <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      placeholder="e.g. 拾光咖啡馆 / 优质原料行"
                      value={supplierForm.name}
                      onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>合作状态</label>
                    <select
                      value={supplierForm.status}
                      onChange={e => setSupplierForm({ ...supplierForm, status: e.target.value })}
                      className={styles.select}
                    >
                      <option value="合作中">合作中 (Active)</option>
                      <option value="暂停合作">暂停合作 (Paused)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>联系方式 / 负责人</label>
                    <input
                      type="text"
                      placeholder="电话、微信、地址等"
                      value={supplierForm.contact}
                      onChange={e => setSupplierForm({ ...supplierForm, contact: e.target.value })}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>最低起订量 (pcs)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="40"
                      value={supplierForm.minOrderQty}
                      onChange={e => setSupplierForm({ ...supplierForm, minOrderQty: e.target.value })}
                      className={styles.input}
                    />
                    <span className={styles.formHint}>默认建议起订量 ≥ 40 件</span>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>标准供货价 (RM)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="4.80"
                      value={supplierForm.standardSupplyPrice}
                      onChange={e => setSupplierForm({ ...supplierForm, standardSupplyPrice: e.target.value })}
                      className={styles.input}
                    />
                    <span className={styles.formHint}>建议标准价 RM4.80</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label>大批量优惠供货价 (RM)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="4.40"
                      value={supplierForm.bulkSupplyPrice}
                      onChange={e => setSupplierForm({ ...supplierForm, bulkSupplyPrice: e.target.value })}
                      className={styles.input}
                    />
                    <span className={styles.formHint}>建议大批量价 RM4.40</span>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>大批量优惠门槛 (pcs)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="100"
                      value={supplierForm.bulkThresholdQty}
                      onChange={e => setSupplierForm({ ...supplierForm, bulkThresholdQty: e.target.value })}
                      className={styles.input}
                    />
                    <span className={styles.formHint}>建议单次订货 ≥ 100 件触发</span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>备注说明</label>
                  <textarea
                    rows="2"
                    placeholder="结算周期、送货约定、对账日期等..."
                    value={supplierForm.notes}
                    onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                    className={styles.input}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className="btn btnSecondary"
                  onClick={() => setIsSupplierModalOpen(false)}
                  disabled={supplierSaving}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btnPrimary"
                  disabled={supplierSaving}
                >
                  {supplierSaving ? '保存中...' : (editingSupplier ? '保存修改' : '创建档案')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
