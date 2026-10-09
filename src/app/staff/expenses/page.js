'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { businessDate, money } from '@/lib/business.mjs';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { uploadReceipt, receiptPreviewUrl, driveFileId } from '@/lib/receiptUpload';
import styles from './page.module.css';

export const GOOGLE_DRIVE_RECEIPTS_URL = 'https://drive.google.com/drive/folders/1CxUKoiIQ5oicc6Eo-vun2pC0-2mG0joh?usp=sharing';

const CATEGORIES = [
  { id: '食材', label: '食材原料 (面粉/黄油/糖/蛋/辅料)', badgeClass: styles.badgeIngredient },
  { id: '包装', label: '包装耗材 (铁盒/纸盒/胶带/贴纸)', badgeClass: styles.badgePackage },
  { id: '摆摊支出', label: '🎪 摆摊/集市现场支出 (摊位费/停车/物料)', badgeClass: styles.badgeBooth },
  { id: 'Supplier采购', label: '🏭 供应商采购支出 (原料/包材批发商)', badgeClass: styles.badgeSupplier },
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
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(() => businessDate().slice(0, 7));
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending_claims' | 'fund_injections'

  // Photo & Screenshot Modal State
  const [previewReceiptRecord, setPreviewReceiptRecord] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Expense Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    date: businessDate(),
    category: '食材',
    amount: '',
    note: '',
    supplierName: '',
    receiptUrl: '',
    paid_by: '公款账户',
    claim_status: 'claimed'
  });

  // Fund Injection Modal State
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [fundFormData, setFundFormData] = useState({
    date: businessDate(),
    amount: '',
    contributor: 'Shinnie',
    note: '',
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExpenses();

    // Fetch suppliers list for supplier procurement category
    async function fetchSuppliers() {
      try {
        const res = await authFetch('/api/suppliers');
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data.suppliers || []);
        }
      } catch (e) {
        console.warn('Failed to load suppliers:', e);
      }
    }
    fetchSuppliers();
  }, [loadExpenses, authFetch]);

  // Handle Receipt Photo Upload (takes photo or file -> uploads to the team Google Drive folder)
  const handlePhotoUpload = async (e, targetRecord = null) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const label = `${(targetRecord?.date || formData.date || '').toString()}_${targetRecord?.category || formData.category || 'receipt'}`;
      const url = await uploadReceipt(file, authFetch, label);
      if (targetRecord) {
        // Direct update on existing record
        const res = await authFetch(`/api/finance/${targetRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ receiptUrl: url })
        });
        if (res.ok) {
          toast.success('收据截图凭证已成功保存！');
          setPreviewReceiptRecord(prev => prev ? { ...prev, receiptUrl: url } : null);
          loadExpenses();
        } else {
          toast.error('保存凭证失败');
        }
      } else {
        setFormData(prev => ({ ...prev, receiptUrl: url }));
        toast.success('收据照片上传成功！');
      }
    } catch (err) {
      toast.error(err.message || '图片上传失败，请重试或粘贴 Google Drive 链接');
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // 公款 (Petty Cash / Common Fund Pool) Calculations
  const fundStats = useMemo(() => {
    let totalInjected = 0;
    let totalClaimed = 0;
    let totalPending = 0;
    const pendingByPayer = {};

    for (const r of records) {
      const amt = Number(r.amount) || 0;
      if (r.transactionType === '公款注资' || r.category === '公款注资') {
        totalInjected += amt;
      } else if (r.transactionType === '支出') {
        const isClaimed = r.claim_status === 'claimed' || r.paid_by === '公款账户' || (!r.claim_status && r.payer === '公款账户');
        const isPending = r.claim_status === 'pending' || (!r.claim_status && (r.paid_by === 'Shinnie' || r.paid_by === 'Yunxuan' || r.payer === 'Shinnie' || r.payer === 'Yunxuan'));

        if (isClaimed) {
          totalClaimed += amt;
        } else if (isPending) {
          totalPending += amt;
          const payer = r.paid_by || r.payer || '员工垫付';
          pendingByPayer[payer] = (pendingByPayer[payer] || 0) + amt;
        }
      }
    }

    const availableBalance = totalInjected - totalClaimed;
    return {
      totalInjected,
      totalClaimed,
      availableBalance,
      totalPending,
      pendingByPayer
    };
  }, [records]);

  // Filtered Records based on tab, month, category, search
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Tab filter
      if (activeTab === 'pending_claims') {
        const isPending = record.transactionType === '支出' && (
          record.claim_status === 'pending' ||
          (!record.claim_status && (record.paid_by === 'Shinnie' || record.paid_by === 'Yunxuan' || record.payer === 'Shinnie' || record.payer === 'Yunxuan'))
        );
        if (!isPending) return false;
      } else if (activeTab === 'fund_injections') {
        if (record.transactionType !== '公款注资' && record.category !== '公款注资') return false;
      } else {
        // 'all' regular expenses
        if (record.transactionType && record.transactionType !== '支出') return false;
      }

      // Month filter (only apply if activeTab !== 'fund_injections' or if selected)
      if (selectedMonth && !record.date?.startsWith(selectedMonth)) return false;

      // Category filter (only in all expenses view)
      if (activeTab === 'all' && selectedCategory !== 'all' && record.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const noteMatch = (record.note || '').toLowerCase().includes(query);
        const supplierMatch = (record.supplierName || '').toLowerCase().includes(query);
        const payerMatch = (record.paid_by || record.payer || record.contributor || '').toLowerCase().includes(query);
        if (!noteMatch && !supplierMatch && !payerMatch) return false;
      }

      return true;
    });
  }, [records, activeTab, selectedMonth, selectedCategory, searchQuery]);

  // KPI Calculations for active expense filter
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

  // Open Expense Modal for Add
  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      date: businessDate(),
      category: '食材',
      amount: '',
      note: '',
      supplierName: '',
      receiptUrl: '',
      paid_by: '公款账户',
      claim_status: 'claimed'
    });
    setIsModalOpen(true);
  };

  // Open Fund Injection Modal
  const handleOpenFundModal = () => {
    setFundFormData({
      date: businessDate(),
      amount: '',
      contributor: 'Shinnie',
      note: '',
      receiptUrl: ''
    });
    setIsFundModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    const paidBy = record.paid_by || record.payer || '公款账户';
    const claimStatus = record.claim_status || (paidBy === '公款账户' ? 'claimed' : 'pending');
    setFormData({
      date: record.date || businessDate(),
      category: record.category || '食材',
      amount: record.amount ? String(record.amount) : '',
      note: record.note || '',
      supplierName: record.supplierName || '',
      receiptUrl: record.receiptUrl || '',
      paid_by: paidBy,
      claim_status: claimStatus
    });
    setIsModalOpen(true);
  };

  // Quick Claim Expense from 公款
  const handleClaimExpense = async (record) => {
    const payer = record.paid_by || record.payer || '垫付人';
    if (!confirm(`确认要从公款中报销「${record.note || '此笔支出'}」共 ${money(record.amount)} 给【${payer}】吗？\n确认后系统将标记为已报销，并自动扣减公款可用余额。`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/finance/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_status: 'claimed',
          claimed_at: new Date().toISOString()
        })
      });

      if (!res.ok) throw new Error('报销处理失败');
      toast.success(`已成功从公款报销 ${money(record.amount)} 给 ${payer}！`);
      loadExpenses();
    } catch (err) {
      toast.error(err.message || '报销处理出错');
    }
  };

  // Submit Expense Form (Create or Update)
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

    const effectiveClaimStatus = formData.paid_by === '公款账户' ? 'claimed' : formData.claim_status;

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
        paid_by: formData.paid_by,
        payer: formData.paid_by,
        claim_status: effectiveClaimStatus,
        claimed_at: effectiveClaimStatus === 'claimed' ? new Date().toISOString() : null,
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

  // Submit Fund Injection Form
  const handleFundSubmit = async (e) => {
    e.preventDefault();
    if (!fundFormData.date) {
      toast.error('请选择注资日期');
      return;
    }
    const numAmount = parseFloat(fundFormData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('请输入有效的注资金额');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        date: fundFormData.date,
        transactionType: '公款注资',
        category: '公款注资',
        amount: numAmount,
        contributor: fundFormData.contributor,
        paid_by: fundFormData.contributor,
        payer: fundFormData.contributor,
        claim_status: 'not_applicable',
        note: fundFormData.note.trim() || `公款备用金充值（来自 ${fundFormData.contributor}）`,
        receiptUrl: fundFormData.receiptUrl.trim(),
        orderType: 'General'
      };

      const res = await authFetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注资记录保存失败');

      toast.success(`成功录入公款注资 ${money(numAmount)}！资金池余额已更新。`);
      setIsFundModalOpen(false);
      loadExpenses();
    } catch (err) {
      toast.error(err.message || '注资记录出错');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Record
  const handleDelete = async (id, note) => {
    if (!confirm(`确定要删除「${note || '此笔记录'}」吗？此操作无法撤销。`)) return;

    try {
      const res = await authFetch(`/api/finance/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除记录失败');
      toast.success('记录已删除');
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
            专用于记录面粉、黄油等烘焙原料、包装耗材及日常运营开销。支持合伙人公款资金池管理与垫付一键报销，并自动计入流水账本及净营业额扣减。
          </p>
        </div>
        <div className={styles.headerActions}>

          <button className="btn btnPrimary" onClick={handleOpenAdd}>
            + 录入新成本支出
          </button>
        </div>
      </header>

      {/* 公款资金池管理看板 */}
      <div className={styles.fundBanner}>
        <div className={styles.fundHeader}>
          <div className={styles.fundTitleBox}>
            <span className={styles.fundIcon}>🏦</span>
            <div>
              <h2 className={styles.fundTitle}>合伙人公款资金池 (备用金池)</h2>
              <p className={styles.fundSubtitle}>
                记录合伙人（Shinnie / Yunxuan / 营业留存）注资与备用金充值，所有采购支出可直接从公款核销报销
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btnPrimary"
            style={{ background: '#059669', borderColor: '#059669', padding: '8px 16px', fontSize: '0.88rem' }}
            onClick={handleOpenFundModal}
          >
            💰 + 注入公款 (充值备用金)
          </button>
        </div>

        <div className={styles.fundMetricsGrid}>
          <div className={`${styles.fundMetricCard} ${fundStats.availableBalance >= 0 ? styles.fundMetricBalance : styles.fundMetricNegative}`}>
            <span className={styles.fundMetricLabel}>公款可用余额 (备用金结余)</span>
            <strong className={styles.fundMetricValue} style={{ color: fundStats.availableBalance >= 0 ? '#15803d' : '#b91c1c' }}>
              {money(fundStats.availableBalance)}
            </strong>
            <span className={styles.fundMetricSubtext}>
              {fundStats.availableBalance < 0 ? '⚠️ 出现超支缺口，请及时注入公款充值' : '充裕可用，可供报销原料采购支出'}
            </span>
          </div>

          <div className={styles.fundMetricCard}>
            <span className={styles.fundMetricLabel}>累积注入公款总额</span>
            <strong className={styles.fundMetricValue} style={{ color: '#2563eb' }}>
              {money(fundStats.totalInjected)}
            </strong>
            <span className={styles.fundMetricSubtext}>包含所有合伙人注资与注资充值</span>
          </div>

          <div className={styles.fundMetricCard}>
            <span className={styles.fundMetricLabel}>已从公款报销 / 公款支出</span>
            <strong className={styles.fundMetricValue} style={{ color: '#475569' }}>
              {money(fundStats.totalClaimed)}
            </strong>
            <span className={styles.fundMetricSubtext}>已实际从公款扣款核销的支出</span>
          </div>

          <div className={`${styles.fundMetricCard} ${fundStats.totalPending > 0 ? styles.fundMetricNegative : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={styles.fundMetricLabel}>待从公款报销总额</span>
              {fundStats.totalPending > 0 && (
                <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  待报销
                </span>
              )}
            </div>
            <strong className={styles.fundMetricValue} style={{ color: fundStats.totalPending > 0 ? '#d97706' : '#10b981' }}>
              {money(fundStats.totalPending)}
            </strong>
            <span className={styles.fundMetricSubtext}>
              {fundStats.totalPending > 0
                ? `合伙人垫付待结算 (Shinnie: ${money(fundStats.pendingByPayer['Shinnie'] || 0)} · Yunxuan: ${money(fundStats.pendingByPayer['Yunxuan'] || 0)})`
                : '所有合伙人垫付账款均已报销清零'}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid (支出宏观统计) */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>本期筛选成本支出</span>
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

      {/* 视图切换 Tabs */}
      <div className={styles.viewTabs}>
        <button
          className={`${styles.viewTabBtn} ${activeTab === 'all' ? styles.viewTabActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          🧾 全部成本支出明细 ({records.filter(r => r.transactionType === '支出').length})
        </button>
        <button
          className={`${styles.viewTabBtn} ${activeTab === 'pending_claims' ? styles.viewTabActive : ''}`}
          onClick={() => setActiveTab('pending_claims')}
        >
          ⏳ 待从公款报销清单 ({records.filter(r => r.transactionType === '支出' && (r.claim_status === 'pending' || (!r.claim_status && (r.paid_by === 'Shinnie' || r.paid_by === 'Yunxuan' || r.payer === 'Shinnie' || r.payer === 'Yunxuan')))).length})
          {fundStats.totalPending > 0 && (
            <span style={{ marginLeft: 6, fontSize: '0.72rem', background: '#f59e0b', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontWeight: 700 }}>
              {money(fundStats.totalPending)}
            </span>
          )}
        </button>
        <button
          className={`${styles.viewTabBtn} ${activeTab === 'fund_injections' ? styles.viewTabActive : ''}`}
          onClick={() => setActiveTab('fund_injections')}
        >
          🏦 公款注资记录 ({records.filter(r => r.transactionType === '公款注资' || r.category === '公款注资').length})
        </button>
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
          {activeTab === 'all' && (
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
          )}
          <input
            type="text"
            className={styles.searchInput}
            placeholder="搜索原料品名、备注、垫付人或供应商..."
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

      {/* Records Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <LoadingSpinner text="正在加载明细..." />
        ) : filteredRecords.length === 0 ? (
          <div className={styles.emptyState}>
            {activeTab === 'pending_claims'
              ? '🎉 太棒了！当前没有任何待从公款报销的垫付支出。'
              : activeTab === 'fund_injections'
                ? '当前时间段暂无公款注资记录。点击上方「💰 注入公款 (充值备用金)」添加第一笔合伙人注资。'
                : '当前筛选条件下暂无成本支出记录。点击上方「+ 录入新成本支出」添加第一笔采购。'}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>类别</th>
                  <th>品项 / 费用说明</th>
                  <th>供应商 / 购买地</th>
                  <th>支付方式与报销状态</th>
                  <th>金额</th>
                  <th>收据凭证</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(item => {
                  const hasDrive = Boolean(item.receiptUrl && item.receiptUrl.trim());
                  const isInjection = item.transactionType === '公款注资' || item.category === '公款注资';
                  const isClaimed = item.claim_status === 'claimed' || item.paid_by === '公款账户' || (!item.claim_status && item.payer === '公款账户');
                  const isPending = !isInjection && (item.claim_status === 'pending' || (!item.claim_status && (item.paid_by === 'Shinnie' || item.paid_by === 'Yunxuan' || item.payer === 'Shinnie' || item.payer === 'Yunxuan')));
                  const payerName = item.paid_by || item.payer || (isInjection ? item.contributor : '公款账户');

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.date}</strong>
                      </td>
                      <td>
                        {isInjection ? (
                          <span className={styles.badgeInjection}>
                            💰 公款注资
                          </span>
                        ) : (
                          <span className={`${styles.badge} ${getBadgeClass(item.category)}`}>
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td>
                        <strong
                          style={{ cursor: 'pointer', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => setPreviewReceiptRecord(item)}
                          title="点击进入查看此笔支出单据截图凭证"
                        >
                          {item.note || '未填写'}
                          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>🔍</span>
                        </strong>
                      </td>
                      <td>
                        {item.supplierName ? (
                          <span>{item.supplierName}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-light)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {isInjection ? (
                          <div>
                            <span className={styles.badgeInjection}>
                              ✓ 注资入池
                            </span>
                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                              注资人: <strong>{item.contributor || payerName || '合伙人'}</strong>
                            </div>
                          </div>
                        ) : isClaimed ? (
                          <div>
                            <span className={styles.badgeClaimed}>
                              ✓ 已从公款报销
                            </span>
                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                              支付方: <strong>{payerName || '公款账户'}</strong>
                            </div>
                          </div>
                        ) : isPending ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <span className={styles.badgePendingClaim}>
                              ⏳ 待从公款报销
                            </span>
                            <span style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 600 }}>
                              垫付人: {payerName || '合伙人'}
                            </span>
                            <button
                              type="button"
                              className={styles.btnQuickClaim}
                              onClick={() => handleClaimExpense(item)}
                              title="点击从公款账户立即结算报销此笔支出给垫付人"
                            >
                              ⚡ 一键从公款报销
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className={styles.badgeClaimed}>
                              ✓ 已结算
                            </span>
                            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                              {payerName}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: isInjection ? '#15803d' : '#dc2626' }}>
                          {isInjection ? `+ ${money(item.amount)}` : `- ${money(item.amount)}`}
                        </strong>
                      </td>
                      <td>
                        {hasDrive ? (
                          <button
                            type="button"
                            className={styles.receiptBtnWithThumb}
                            onClick={() => setPreviewReceiptRecord(item)}
                            title="点击进入查看此单据截图凭证"
                          >
                            {item.receiptUrl.startsWith('http') && !item.receiptUrl.includes('drive.google.com') ? (
                              <img src={item.receiptUrl} alt="凭证" className={styles.receiptThumbMini} />
                            ) : (
                              <span>📂</span>
                            )}
                            <span>查看截图凭证</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.receiptBtnMissing}
                            onClick={() => setPreviewReceiptRecord(item)}
                            title="尚未拍照上传凭证，点击立即拍照录入"
                          >
                            <span>📷</span>
                            <span>补传单据截图</span>
                          </button>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          {!isInjection && (
                            <button
                              className={styles.btnEdit}
                              onClick={() => handleOpenEdit(item)}
                            >
                              编辑
                            </button>
                          )}
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
        maxWidth="580px"
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
              <label>
                {formData.category === 'Supplier采购' ? '供应商 / 合作厂商 *' : formData.category === '摆摊支出' ? '摆摊活动 / 市集地点 *' : '供应商 / 采购商行'}
              </label>
              {formData.category === 'Supplier采购' && suppliers.length > 0 && (
                <select
                  value={formData.supplierName}
                  onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                  style={{ marginBottom: '6px' }}
                >
                  <option value="">-- 从合作供应商库中快捷选择 --</option>
                  {suppliers.map(s => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name} {s.contact ? `(${s.contact})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder={
                  formData.category === 'Supplier采购'
                    ? '例如: Bake With Yen / 顶好食品批发'
                    : formData.category === '摆摊支出'
                      ? '例如: 谷中城周末集市 / Pavilion 快闪店 / 社区市集'
                      : '例如: Bake With Yen / Sheng Siong'
                }
                value={formData.supplierName}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
              />
            </div>
          </div>

          {/* 公款支付与报销选项 */}
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>支出支付方 (谁付的钱) *</label>
              <select
                value={formData.paid_by}
                onChange={e => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    paid_by: val,
                    // Auto-adjust default claim status based on payer
                    claim_status: val === '公款账户' ? 'claimed' : 'pending'
                  });
                }}
              >
                <option value="公款账户">公款账户 (直接由公款/备用金池支付)</option>
                <option value="Shinnie">Shinnie 个人垫付 (待从公款报销)</option>
                <option value="Yunxuan">Yunxuan 个人垫付 (待从公款报销)</option>
              </select>
            </div>
            <div className={styles.formField}>
              <label>公款报销状态 *</label>
              <select
                value={formData.claim_status}
                onChange={e => setFormData({ ...formData, claim_status: e.target.value })}
              >
                <option value="claimed">已从公款报销 / 公款直接支付 (已平账)</option>
                <option value="pending">待从公款报销 (挂账待领备用金)</option>
              </select>
            </div>
          </div>

          <div className={styles.formField}>
            <label>
              {formData.category === '摆摊支出' ? '摆摊现场支出品项说明 *' : formData.category === 'Supplier采购' ? '供应商采购商品明细与批号 *' : '原料品项与规格说明 *'}
            </label>
            <input
              type="text"
              required
              placeholder={
                formData.category === '摆摊支出'
                  ? '例如: 摊位租金 2 天 / 现场冰块与矿泉水 / 停车费与油费补贴'
                  : formData.category === 'Supplier采购'
                    ? '例如: Anchor 动物黄油 20 箱 (批次 202610A) / 定制曲奇铁盒 500 个'
                    : '例如: Anchor 动物黄油 10 箱 / 顶级高筋面粉 50kg'
              }
              value={formData.note}
              onChange={e => setFormData({ ...formData, note: e.target.value })}
            />
            <span className={styles.fieldHint}>填写采购或支出的具体品类、数量、重量或批次说明</span>
          </div>

          {/* 拍照 / 上传截图与 Google Drive */}
          <div className={styles.formField}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ margin: 0, fontWeight: 700 }}>📷 收据/发票拍照凭证与截图 *</label>
              <a
                href={GOOGLE_DRIVE_RECEIPTS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.78rem', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
              >
                📂 打开团队 Google Drive 云盘 ↗
              </a>
            </div>

            <div className={styles.photoUploadBox}>
              <input
                type="file"
                id="expenseModalPhotoInput"
                accept="image/*"
                capture="environment"
                className={styles.photoUploadInput}
                onChange={e => handlePhotoUpload(e)}
                disabled={uploadingPhoto}
              />
              <label htmlFor="expenseModalPhotoInput" className={styles.photoUploadBtn}>
                {uploadingPhoto ? '⏳ 正在拍照上传中...' : '📷 拍照 / 上传单据发票照片'}
              </label>
              <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                手机端可直接调起相机拍照；电脑端可上传截图或扫描件
              </p>

              {formData.receiptUrl && (
                <div className={styles.photoPreviewContainer}>
                  {driveFileId(formData.receiptUrl) ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                      <img src={receiptPreviewUrl(formData.receiptUrl)} alt="收据凭证" className={styles.photoPreviewImg} />
                      <span style={{ fontSize: '0.76rem', color: '#1e40af', fontWeight: 600 }}>📂 已保存至 Google Drive</span>
                    </div>
                  ) : formData.receiptUrl.includes('drive.google.com') ? (
                    <div style={{ padding: '8px 14px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>
                      📂 已关联 Google Drive 云盘文件
                    </div>
                  ) : (
                    <img src={formData.receiptUrl} alt="收据凭证" className={styles.photoPreviewImg} />
                  )}
                  <button
                    type="button"
                    className={styles.photoRemoveBtn}
                    title="移除图片"
                    onClick={() => setFormData(prev => ({ ...prev, receiptUrl: '' }))}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: '0.76rem', color: 'var(--color-text-light)', display: 'block', marginBottom: 4 }}>
                或直接粘贴 Google Drive 分享链接 / 外部图片链接:
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/file/d/... 或留空"
                value={formData.receiptUrl}
                onChange={e => setFormData({ ...formData, receiptUrl: e.target.value })}
                style={{ fontSize: '0.82rem' }}
              />
              <span className={styles.fieldHint}>
                💡 团队所有单据均在共享 Google Drive 集中归档，建议拍摄清晰发票以便查验。
              </span>
            </div>
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

      {/* Fund Injection (公款注资 / 充值备用金) Modal */}
      <Modal
        isOpen={isFundModalOpen}
        onClose={() => setIsFundModalOpen(false)}
        title="💰 注入公款 (充值备用金资金池)"
        maxWidth="520px"
      >
        <form onSubmit={handleFundSubmit} className={styles.modalForm}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 14px' }}>
            <strong style={{ fontSize: '0.88rem', color: '#1e40af' }}>🏦 公款注资说明</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#1d4ed8', lineHeight: '1.4' }}>
              注资后金额将即刻增加「公款资金池可用余额」，用于后续合伙人报销原料采购支出或直接划扣公款支出。
            </p>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label>注资日期 *</label>
              <input
                type="date"
                required
                value={fundFormData.date}
                onChange={e => setFundFormData({ ...fundFormData, date: e.target.value })}
              />
            </div>
            <div className={styles.formField}>
              <label>注资人 / 来源 *</label>
              <select
                value={fundFormData.contributor}
                onChange={e => setFundFormData({ ...fundFormData, contributor: e.target.value })}
              >
                <option value="Shinnie">Shinnie (合伙人注资)</option>
                <option value="Yunxuan">Yunxuan (合伙人注资)</option>
                <option value="两人合资 (各半)">两人合资 (各半)</option>
                <option value="营业利润留存">营业利润留存</option>
                <option value="其他来源">其他来源</option>
              </select>
            </div>
          </div>

          <div className={styles.formField}>
            <label>注资金额 (RM) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="例如: 500.00"
              value={fundFormData.amount}
              onChange={e => setFundFormData({ ...fundFormData, amount: e.target.value })}
            />
          </div>

          <div className={styles.formField}>
            <label>款项备注 / 用途说明</label>
            <input
              type="text"
              placeholder="例如: 3月份烘焙原料采购启动备用金 / 两人平摊注资"
              value={fundFormData.note}
              onChange={e => setFundFormData({ ...fundFormData, note: e.target.value })}
            />
          </div>

          <div className={styles.formField}>
            <label>转账凭证 / 银行收据链接 (选填)</label>
            <input
              type="url"
              placeholder="如有转账单据或云盘凭证链接可粘贴于此"
              value={fundFormData.receiptUrl}
              onChange={e => setFundFormData({ ...fundFormData, receiptUrl: e.target.value })}
            />
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className="btn btnSecondary"
              onClick={() => setIsFundModalOpen(false)}
              disabled={actionLoading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btnPrimary"
              style={{ background: '#059669', borderColor: '#059669' }}
              disabled={actionLoading}
            >
              {actionLoading ? '保存中...' : '确认注入公款'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 支出单据截图与凭证查看 Modal (Requirement 3: 每个支出点进去都要进入相应的截图) */}
      <Modal
        isOpen={Boolean(previewReceiptRecord)}
        onClose={() => setPreviewReceiptRecord(null)}
        title={previewReceiptRecord ? `🧾 支出凭证截图 · ${previewReceiptRecord.note || '支出详情'}` : '支出凭证'}
        maxWidth="680px"
      >
        {previewReceiptRecord && (
          <div className={styles.screenshotViewer}>
            {/* Image / Drive Preview Area */}
            {previewReceiptRecord.receiptUrl ? (
              <div className={styles.screenshotImageBox}>
                {previewReceiptRecord.receiptUrl.includes('drive.google.com') ? (
                  <div style={{ textAlign: 'center', padding: '30px 20px', color: '#fff' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📂</div>
                    <strong style={{ fontSize: '1.1rem', display: 'block', marginBottom: '8px' }}>Google Drive 云端收据文档</strong>
                    <p style={{ fontSize: '0.85rem', color: '#cbd5e1', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                      此凭证存储在团队 Google Drive 云盘中。点击下方按钮即可一键跳转查看原图或完整 PDF 发票。
                    </p>
                    <a
                      href={previewReceiptRecord.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btnPrimary"
                      style={{ textDecoration: 'none', padding: '10px 20px', fontWeight: 700 }}
                    >
                      在 Google Drive 中打开完整单据 ↗
                    </a>
                  </div>
                ) : (
                  <img
                    src={previewReceiptRecord.receiptUrl}
                    alt="支出单据发票截图"
                    className={styles.screenshotModalImg}
                  />
                )}
              </div>
            ) : (
              <div className={styles.photoUploadBox} style={{ padding: '36px 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📷</div>
                <strong style={{ fontSize: '1rem', color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>
                  此笔支出尚未上传凭证或拍照
                </strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', maxWidth: '380px', margin: '0 auto 16px' }}>
                  团队要求每笔支出均需拍照存证。您可以直接调起手机相机拍照上传，或存入 Google Drive 文件夹。
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    id="quickUploadReceiptInput"
                    accept="image/*"
                    capture="environment"
                    className={styles.photoUploadInput}
                    onChange={e => handlePhotoUpload(e, previewReceiptRecord)}
                    disabled={uploadingPhoto}
                  />
                  <label htmlFor="quickUploadReceiptInput" className={styles.photoUploadBtn} style={{ background: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}>
                    {uploadingPhoto ? '⏳ 正在上传...' : '📷 立即拍照 / 上传截图凭证'}
                  </label>
                  <a
                    href={GOOGLE_DRIVE_RECEIPTS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btnSecondary"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    📂 打开 Google Drive 云盘 ↗
                  </a>
                </div>
              </div>
            )}

            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {previewReceiptRecord.receiptUrl && !previewReceiptRecord.receiptUrl.includes('drive.google.com') && (
                  <a
                    href={previewReceiptRecord.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btnSecondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    🔍 在新窗口打开原图 ↗
                  </a>
                )}
                <a
                  href={GOOGLE_DRIVE_RECEIPTS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btnSecondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  📂 打开团队 Google Drive ↗
                </a>
              </div>

              <div>
                <input
                  type="file"
                  id="replaceReceiptPhotoInput"
                  accept="image/*"
                  capture="environment"
                  className={styles.photoUploadInput}
                  onChange={e => handlePhotoUpload(e, previewReceiptRecord)}
                  disabled={uploadingPhoto}
                />
                <label htmlFor="replaceReceiptPhotoInput" className="btn btnSecondary" style={{ fontSize: '0.8rem', padding: '6px 12px', cursor: 'pointer' }}>
                  {uploadingPhoto ? '⏳ 正在上传中...' : '📷 更换/重拍凭证照片'}
                </label>
              </div>
            </div>

            {/* Expense Audit Metadata Card */}
            <div className={styles.screenshotMetaCard}>
              <div className={styles.screenshotMetaItem}>
                <span className={styles.screenshotMetaLabel}>品项与说明</span>
                <span className={styles.screenshotMetaValue}>{previewReceiptRecord.note || '未填写品项'}</span>
              </div>
              <div className={styles.screenshotMetaItem}>
                <span className={styles.screenshotMetaLabel}>支出金额</span>
                <span className={styles.screenshotMetaValue} style={{ color: '#dc2626', fontSize: '1.05rem', fontWeight: 700 }}>
                  - {money(previewReceiptRecord.amount)}
                </span>
              </div>
              <div className={styles.screenshotMetaItem}>
                <span className={styles.screenshotMetaLabel}>支出日期</span>
                <span className={styles.screenshotMetaValue}>{previewReceiptRecord.date}</span>
              </div>
              <div className={styles.screenshotMetaItem}>
                <span className={styles.screenshotMetaLabel}>费用类别</span>
                <span className={styles.screenshotMetaValue}>
                  <span className={`${styles.badge} ${getBadgeClass(previewReceiptRecord.category)}`}>
                    {previewReceiptRecord.category}
                  </span>
                </span>
              </div>
              <div className={styles.screenshotMetaItem}>
                <span className={styles.screenshotMetaLabel}>供应商 / 购买地点</span>
                <span className={styles.screenshotMetaValue}>{previewReceiptRecord.supplierName || '—'}</span>
              </div>
              <div className={styles.screenshotMetaItem}>
                <span className={styles.screenshotMetaLabel}>支付人与公款状态</span>
                <span className={styles.screenshotMetaValue}>
                  {previewReceiptRecord.paid_by || previewReceiptRecord.payer || '公款账户'}
                  {previewReceiptRecord.claim_status === 'claimed' ? ' (✓ 已平账)' : ' (⏳ 待报销)'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className="btn btnPrimary"
                onClick={() => setPreviewReceiptRecord(null)}
              >
                关闭查看
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

