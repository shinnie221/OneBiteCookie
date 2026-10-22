'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Modal from '@/components/Modal/Modal';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { businessDate } from '@/lib/business.mjs';
import {
  formatMYDate,
  formatMYR,
  LHDN_CATEGORIES,
  normalizeSalesTransactions,
  normalizeExpenseRecords,
  calculateProfitAndLoss,
  calculateInventoryStatus,
  exportToExcel,
  exportMultiSheetExcel,
  exportToCSV
} from '@/lib/taxReport.mjs';
import styles from './page.module.css';

export default function TaxReportPage() {
  return (
    <Suspense fallback={<LoadingSpinner text="正在加载税务与销售报表..." />}>
      <TaxReportContent />
    </Suspense>
  );
}

function TaxReportContent() {
  const { authFetch, user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Raw Data from Firestore
  const [orders, setOrders] = useState([]);
  const [businessRecords, setBusinessRecords] = useState([]);
  const [financeRecords, setFinanceRecords] = useState([]);
  const [productionRecords, setProductionRecords] = useState([]);
  const [products, setProducts] = useState([]);

  // Active Tab: 'sales' | 'expenses' | 'pnl' | 'inventory'
  const [activeTab, setActiveTab] = useState('sales');

  // Date Filters
  const today = businessDate();
  const currentYear = today.slice(0, 4);
  const currentMonth = today.slice(0, 7);

  const [dateRangeMode, setDateRangeMode] = useState('year'); // 'today' | 'yesterday' | 'month' | 'last_month' | 'year' | 'last_year' | 'all' | 'custom'
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Sales Filters
  const [salesSearch, setSalesSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all'); // 'all' | 'cash' | 'duitnow_qr' | 'bank_transfer'
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all'); // 'all' | 'completed' | 'pending' | 'refunded' | 'cancelled'
  const [channelFilter, setChannelFilter] = useState('all'); // 'all' | 'Online Pre-order' | 'Booth / Market' | 'Wholesale'

  // Expense Filters
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseFormData, setExpenseFormData] = useState({
    date: businessDate(),
    category: '食材',
    amount: '',
    description: '',
    supplierName: '',
    paid_by: '公款账户',
    receiptUrl: '',
    claim_status: 'claimed'
  });

  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [productionFormData, setProductionFormData] = useState({
    date: businessDate(),
    product_name: '',
    quantity_produced: '',
    batch_code: '',
    notes: ''
  });

  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);

  // Load all actual records from Firestore
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, businessRes, financeRes, prodRes, prodsRes] = await Promise.all([
        authFetch('/api/orders'),
        authFetch('/api/business'),
        authFetch('/api/finance'),
        authFetch('/api/production'),
        authFetch('/api/products')
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData.orders || []);
      }
      if (businessRes.ok) {
        const bData = await businessRes.json();
        setBusinessRecords(bData.records || []);
      }
      if (financeRes.ok) {
        const fData = await financeRes.json();
        setFinanceRecords(fData.records || []);
      }
      if (prodRes.ok) {
        const pData = await prodRes.json();
        setProductionRecords(pData.records || []);
      }
      if (prodsRes.ok) {
        const prData = await prodsRes.json();
        const catalog = prData.products || [];
        setProducts(catalog);
        if (catalog.length > 0 && !productionFormData.product_name) {
          setProductionFormData(prev => ({ ...prev, product_name: catalog[0].name }));
        }
      }
    } catch (err) {
      console.error('Failed to load tax & sales data:', err);
      toast.error('加载税务与财务报表失败，请检查网络后重试');
    } finally {
      setLoading(false);
    }
  }, [authFetch, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAllData();
  }, [fetchAllData]);

  // Handle Preset Date Filter Changes
  const handlePresetDate = (mode, yearVal = null) => {
    setDateRangeMode(mode);
    const now = businessDate();
    const curY = now.slice(0, 4);

    if (mode === 'today') {
      setDateFrom(now);
      setDateTo(now);
    } else if (mode === 'yesterday') {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const yDate = d.toISOString().slice(0, 10);
      setDateFrom(yDate);
      setDateTo(yDate);
    } else if (mode === 'month') {
      const curM = now.slice(0, 7);
      setDateFrom(`${curM}-01`);
      setDateTo(`${curM}-31`);
    } else if (mode === 'last_month') {
      const [y, m] = now.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      setDateFrom(`${ym}-01`);
      setDateTo(`${ym}-31`);
    } else if (mode === 'year') {
      const targetYear = yearVal || selectedYear || curY;
      setSelectedYear(targetYear);
      setDateFrom(`${targetYear}-01-01`);
      setDateTo(`${targetYear}-12-31`);
    } else if (mode === 'all') {
      setDateFrom('2026-01-01');
      setDateTo(`${curY}-12-31`);
    }
  };

  // Normalized datasets
  const allSales = useMemo(() => {
    return normalizeSalesTransactions(orders, businessRecords);
  }, [orders, businessRecords]);

  const allExpenses = useMemo(() => {
    return normalizeExpenseRecords(financeRecords);
  }, [financeRecords]);

  // Filtered Sales according to Date Range & Criteria
  const filteredSales = useMemo(() => {
    return allSales.filter(tx => {
      if (dateFrom && tx.date < dateFrom) return false;
      if (dateTo && tx.date > dateTo) return false;

      // Method filter
      if (paymentMethodFilter !== 'all') {
        if (!tx.paymentMethod.toLowerCase().includes(paymentMethodFilter.toLowerCase())) return false;
      }

      // Status filter
      if (paymentStatusFilter === 'completed' && !tx.isPaidCompleted) return false;
      if (paymentStatusFilter === 'pending' && (tx.isPaidCompleted || tx.isRefunded || tx.isCancelled)) return false;
      if (paymentStatusFilter === 'refunded' && !tx.isRefunded) return false;
      if (paymentStatusFilter === 'cancelled' && !tx.isCancelled) return false;

      // Channel filter
      if (channelFilter !== 'all' && tx.channel !== channelFilter) return false;

      // Search
      if (salesSearch.trim()) {
        const query = salesSearch.toLowerCase();
        const matchId = tx.id.toLowerCase().includes(query);
        const matchCustomer = tx.customer.toLowerCase().includes(query);
        const matchFlavours = tx.flavourSummary.toLowerCase().includes(query);
        const matchRef = tx.transactionRef.toLowerCase().includes(query);
        if (!matchId && !matchCustomer && !matchFlavours && !matchRef) return false;
      }

      return true;
    });
  }, [allSales, dateFrom, dateTo, paymentMethodFilter, paymentStatusFilter, channelFilter, salesSearch]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(exp => {
      if (dateFrom && exp.date < dateFrom) return false;
      if (dateTo && exp.date > dateTo) return false;

      if (expenseCategoryFilter !== 'all' && exp.categoryKey !== expenseCategoryFilter) return false;

      if (expenseSearch.trim()) {
        const q = expenseSearch.toLowerCase();
        const matchDesc = (exp.description || '').toLowerCase().includes(q);
        const matchSupplier = (exp.supplierName || '').toLowerCase().includes(q);
        const matchCat = (exp.categoryLabelZh || '').toLowerCase().includes(q);
        if (!matchDesc && !matchSupplier && !matchCat) return false;
      }

      return true;
    });
  }, [allExpenses, dateFrom, dateTo, expenseCategoryFilter, expenseSearch]);

  // Profit and Loss & LHDN Tax Adjustments
  const pnlSummary = useMemo(() => {
    return calculateProfitAndLoss(allSales, allExpenses, { from: dateFrom, to: dateTo });
  }, [allSales, allExpenses, dateFrom, dateTo]);

  // Inventory & Stock Status
  const inventoryStatus = useMemo(() => {
    return calculateInventoryStatus(products, productionRecords, allSales, allExpenses);
  }, [products, productionRecords, allSales, allExpenses]);

  // Quick Totals for Sales Tab
  const salesTotals = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let delivery = 0;
    let refunds = 0;
    let net = 0;
    let totalQty = 0;

    for (const tx of filteredSales) {
      if (tx.isPaidCompleted) {
        gross += tx.subtotal;
        discount += tx.discount;
        delivery += tx.deliveryFee;
        refunds += tx.refundAmount;
        net += tx.netAmount;
        totalQty += tx.totalQuantity;
      }
    }
    return { gross, discount, delivery, refunds, net, totalQty, count: filteredSales.length };
  }, [filteredSales]);

  // Quick Totals for Expense Tab
  const expenseTotals = useMemo(() => {
    let total = 0;
    let deductible = 0;
    let capital = 0;
    for (const exp of filteredExpenses) {
      total += exp.amount;
      if (exp.isCapital) capital += exp.amount;
      else deductible += exp.amount;
    }
    return { total, deductible, capital, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // Channel Separated Datasets
  const onlineSales = useMemo(() => {
    return filteredSales.filter(tx => tx.channel === 'Online Pre-order' || tx.channel === 'Manual POS');
  }, [filteredSales]);

  const boothSales = useMemo(() => {
    return filteredSales.filter(tx => tx.channel === 'Booth / Market');
  }, [filteredSales]);

  const supplierSales = useMemo(() => {
    return filteredSales.filter(tx => tx.channel === 'Wholesale');
  }, [filteredSales]);

  // Channel Sub-totals
  const onlineTotals = useMemo(() => {
    let gross = 0, discount = 0, delivery = 0, refunds = 0, net = 0, pieces = 0;
    for (const tx of onlineSales) {
      if (tx.isPaidCompleted) {
        gross += tx.subtotal;
        discount += tx.discount;
        delivery += tx.deliveryFee;
        refunds += tx.refundAmount;
        net += tx.netAmount;
        pieces += tx.totalQuantity;
      }
    }
    return { gross, discount, delivery, refunds, net, pieces, count: onlineSales.length };
  }, [onlineSales]);

  const boothTotals = useMemo(() => {
    let gross = 0, discount = 0, net = 0, pieces = 0;
    for (const tx of boothSales) {
      if (tx.isPaidCompleted) {
        gross += tx.subtotal;
        discount += tx.discount;
        net += tx.netAmount;
        pieces += tx.totalQuantity;
      }
    }
    return { gross, discount, net, pieces, count: boothSales.length };
  }, [boothSales]);

  const supplierTotals = useMemo(() => {
    let gross = 0, discount = 0, invoiced = 0, received = 0, outstanding = 0, pieces = 0;
    for (const tx of supplierSales) {
      if (tx.isPaidCompleted) {
        gross += tx.subtotal;
        discount += tx.discount;
        invoiced += tx.totalAmount;
        received += tx.netAmount;
        outstanding += (tx.outstanding || 0);
        pieces += tx.totalQuantity;
      }
    }
    return { gross, discount, invoiced, received, outstanding, pieces, count: supplierSales.length };
  }, [supplierSales]);

  // Export formatters
  const formatExportPaymentMethod = (m) => {
    if (!m) return 'DuitNow QR';
    const s = String(m).toLowerCase();
    if (s.includes('cash') || s.includes('现金')) return 'Cash';
    if (s.includes('bank') || s.includes('transfer') || s.includes('转账')) return 'Bank Transfer';
    if (s.includes('qr') || s.includes('duitnow')) return 'DuitNow QR';
    return m;
  };

  const formatExportPaymentStatus = (s) => {
    if (!s) return 'Completed';
    const str = String(s).toLowerCase();
    if (str === 'verified' || str === 'completed') return 'Completed / Verified';
    if (str === 'pending') return 'Pending';
    if (str === 'partial_paid') return 'Partial Paid';
    if (str === 'refunded') return 'Refunded';
    if (str === 'cancelled') return 'Cancelled';
    return s;
  };

  const formatExportExpensePayer = (p) => {
    if (!p) return 'Company Account';
    if (p === '公款账户') return 'Company Account';
    if (p.includes('个人垫付')) {
      return p.replace(/\s*\(个人垫付\)/g, ' (Personal Advance)').replace(/（个人垫付）/g, ' (Personal Advance)');
    }
    return p;
  };

  // Export handlers
  const handleExportSales = () => {
    // 1. Online headers and rows
    const onlineHeaders = [
      'Transaction Date (DD/MM/YYYY)',
      'Order ID',
      'Channel',
      'Customer Name',
      'Contact Phone',
      'Cookie Flavours & Quantities',
      'Pieces Sold',
      'Subtotal (RM)',
      'Discount (RM)',
      'Delivery Fee (RM)',
      'Net Amount (RM)',
      'Payment Method',
      'Payment Status',
      'Refund (RM)',
      'Slip / Ref No.',
      'Staff Notes'
    ];
    const onlineRows = onlineSales.map(tx => [
      formatMYDate(tx.date),
      tx.id,
      tx.channel,
      tx.customerName,
      tx.phone,
      tx.flavourSummary,
      tx.totalQuantity,
      tx.subtotal.toFixed(2),
      tx.discount.toFixed(2),
      tx.deliveryFee.toFixed(2),
      tx.netAmount.toFixed(2),
      formatExportPaymentMethod(tx.paymentMethod),
      formatExportPaymentStatus(tx.paymentStatus),
      tx.refundAmount.toFixed(2),
      tx.transactionRef,
      tx.notes
    ]);

    // 2. Booth headers and rows
    const boothHeaders = [
      'Booth Date (DD/MM/YYYY)',
      'Booth ID',
      'Event / Location Venue',
      'Flavours Prepared & Sold',
      'Pieces Sold',
      'Gross Sales (RM)',
      'Discount (RM)',
      'Net Amount Received (RM)',
      'Payment Method',
      'Status',
      'Settlement Ref'
    ];
    const boothRows = boothSales.map(tx => [
      formatMYDate(tx.date),
      tx.id,
      tx.customerName,
      tx.flavourSummary,
      tx.totalQuantity,
      tx.subtotal.toFixed(2),
      tx.discount.toFixed(2),
      tx.netAmount.toFixed(2),
      'DuitNow QR / Cash',
      tx.orderStatus === 'completed' || tx.paymentStatus === 'verified' || tx.paymentStatus === 'completed' ? 'Completed' : 'In Progress',
      tx.transactionRef
    ]);

    // 3. Supplier headers and rows
    const supplierHeaders = [
      'Supply Date (DD/MM/YYYY)',
      'Invoice / Wholesale ID',
      'Partner Store / Buyer',
      'Contact Phone',
      'Flavours & Quantities Supplied',
      'Pieces Supplied',
      'Wholesale Subtotal (RM)',
      'Discount (RM)',
      'Invoiced Total (RM)',
      'Amount Received (RM)',
      'Outstanding Receivables (RM)',
      'Payment Status',
      'Notes'
    ];
    const supplierRows = supplierSales.map(tx => [
      formatMYDate(tx.date),
      tx.id,
      tx.customerName,
      tx.phone,
      tx.flavourSummary,
      tx.totalQuantity,
      tx.subtotal.toFixed(2),
      tx.discount.toFixed(2),
      tx.totalAmount.toFixed(2),
      tx.netAmount.toFixed(2),
      (tx.outstanding || 0).toFixed(2),
      (tx.outstanding || 0) > 0 ? 'Partial Paid' : 'Fully Paid',
      tx.notes
    ]);

    if (channelFilter === 'online') {
      exportToExcel(`OneBite_Online_Orders_${dateFrom}_to_${dateTo}`, 'Online Orders', onlineHeaders, onlineRows);
      toast.success('Online orders report exported as Excel (.xlsx)');
    } else if (channelFilter === 'booth') {
      exportToExcel(`OneBite_Booth_Sales_${dateFrom}_to_${dateTo}`, 'Booth Sales', boothHeaders, boothRows);
      toast.success('Booth sales report exported as Excel (.xlsx)');
    } else if (channelFilter === 'supplier') {
      exportToExcel(`OneBite_Supplier_Wholesale_${dateFrom}_to_${dateTo}`, 'Supplier & Wholesale', supplierHeaders, supplierRows);
      toast.success('Supplier & wholesale report exported as Excel (.xlsx)');
    } else {
      exportMultiSheetExcel(`OneBite_Sales_Report_All_Sections_${dateFrom}_to_${dateTo}`, [
        { sheetName: 'Online Orders', headers: onlineHeaders, rows: onlineRows },
        { sheetName: 'Booth Sales', headers: boothHeaders, rows: boothRows },
        { sheetName: 'Supplier & Wholesale', headers: supplierHeaders, rows: supplierRows },
      ]);
      toast.success('All-channel sales report exported as Excel (.xlsx) with 3 sheets');
    }
  };

  const handleExportExpenses = () => {
    const headers = [
      'Expense Date (DD/MM/YYYY)',
      'LHDN Category',
      'Description / Purpose',
      'Supplier / Payee',
      'Amount (RM)',
      'Tax Deductibility (LHDN)',
      'Payment Method',
      'Claim Status',
      'Receipt Attachment Link',
      'Notes'
    ];

    const rows = filteredExpenses.map(exp => [
      formatMYDate(exp.date),
      exp.categoryLabelEn,
      exp.description,
      exp.supplierName || '-',
      exp.amount.toFixed(2),
      exp.isCapital ? 'Capital Allowance (Non-deductible operational)' : 'Fully Allowable Operating Expense',
      formatExportExpensePayer(exp.paymentMethod),
      exp.claimStatus === 'claimed' ? 'Claimed / Settled' : 'Pending Reimbursement',
      exp.receiptUrl || '-',
      exp.notes
    ]);

    const filename = `OneBite_Expense_Report_${dateFrom}_to_${dateTo}`;
    exportToExcel(filename, 'Expense Report', headers, rows);
    toast.success('Expense report exported as Excel (.xlsx)');
  };

  const handleExportPnL = () => {
    const headers = ['Financial Metric (LHDN Form B / P Preparation)', 'Amount (RM)', 'Tax Treatment / Remarks'];
    const rows = [
      ['Gross Cookie Sales', pnlSummary.grossSales.toFixed(2), 'Gross receipts before discounts'],
      ['Less: Discounts & Vouchers', `-${pnlSummary.discounts.toFixed(2)}`, 'Promotional and customer discounts'],
      ['Add: Delivery Charges Collected', pnlSummary.deliveryCharges.toFixed(2), 'Delivery fee income'],
      ['Less: Order Refunds', `-${pnlSummary.refunds.toFixed(2)}`, 'Returned and refunded transactions'],
      ['NET BUSINESS REVENUE', pnlSummary.netSales.toFixed(2), 'Total recognized business revenue'],
      ['----------------------------------------', '----------', '----------------------------------------'],
      ['Allowable Operating Expenses', `-${pnlSummary.allowableExpenses.toFixed(2)}`, 'Ingredients, packaging, rental, utilities, bank fees'],
      ['Capital Expenditures (Schedule 3 Assets)', `-${pnlSummary.capitalExpenditures.toFixed(2)}`, 'Ovens, mixers, machinery (Schedule 3 assets)'],
      ['TOTAL BUSINESS EXPENSES', `-${pnlSummary.totalExpenses.toFixed(2)}`, 'Sum of all cash and fund disbursements'],
      ['----------------------------------------', '----------', '----------------------------------------'],
      ['ACCOUNTING NET PROFIT / (LOSS)', pnlSummary.accountingProfit.toFixed(2), 'Book profit under standard accounting rules'],
      ['Add Back: Capital Asset Purchases', `+${pnlSummary.capitalExpenditures.toFixed(2)}`, 'Non-deductible as revenue expense under LHDN rules'],
      ['Less: Estimated Capital Allowance (Initial 20% + Annual 12%)', `-${pnlSummary.estimatedCapitalAllowance.toFixed(2)}`, 'Est. 32% (20% Initial + 12% Annual Allowance)'],
      ['ESTIMATED TAXABLE BUSINESS INCOME', pnlSummary.taxableIncome.toFixed(2), 'Statutory business income for LHDN Form B/P preparation']
    ];

    const filename = `OneBite_PnL_Tax_Summary_${dateFrom}_to_${dateTo}`;
    exportToExcel(filename, 'PnL & Tax Summary', headers, rows);
    toast.success('PnL & Tax report exported as Excel (.xlsx)');
  };

  const handleExportInventory = () => {
    const headers = [
      'Cookie Flavour',
      'Produced Pieces (Baking & Prep)',
      'Sold Pieces (All Channels)',
      'Samples & Wastage',
      'Remaining Stock Balance (Pieces)',
      'Unit Retail Price (RM)',
      'Est. Remaining Stock Value (RM)'
    ];

    const rows = inventoryStatus.inventoryList.map(item => [
      item.name,
      item.producedPieces,
      item.soldPieces,
      item.wastePieces,
      item.remainingPieces,
      item.unitPrice.toFixed(2),
      item.estimatedStockValue.toFixed(2)
    ]);

    const filename = `OneBite_Inventory_Stock_${today}`;
    exportToExcel(filename, 'Inventory Stock', headers, rows);
    toast.success('Inventory stock report exported as Excel (.xlsx)');
  };

  // Add Expense submission
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseFormData.amount || Number(expenseFormData.amount) <= 0) {
      toast.error('请输入有效的支出金额');
      return;
    }
    setActionLoading(true);
    try {
      const res = await authFetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: expenseFormData.date,
          transactionType: '支出',
          category: expenseFormData.category,
          amount: parseFloat(expenseFormData.amount),
          orderType: 'General',
          note: expenseFormData.description,
          supplierName: expenseFormData.supplierName,
          paid_by: expenseFormData.paid_by,
          payer: expenseFormData.paid_by,
          claim_status: expenseFormData.claim_status,
          receiptUrl: expenseFormData.receiptUrl
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存支出失败');
      }

      toast.success('支出记录已成功添加到数据库');
      setIsExpenseModalOpen(false);
      setExpenseFormData({
        date: businessDate(),
        category: '食材',
        amount: '',
        description: '',
        supplierName: '',
        paid_by: '公款账户',
        receiptUrl: '',
        claim_status: 'claimed'
      });
      fetchAllData();
    } catch (err) {
      toast.error(err.message || '保存支出记录失败');
    } finally {
      setActionLoading(false);
    }
  };

  // Log Production Batch submission
  const handleSaveProduction = async (e) => {
    e.preventDefault();
    if (!productionFormData.quantity_produced || Number(productionFormData.quantity_produced) <= 0) {
      toast.error('请输入有效的生产烘焙数量');
      return;
    }
    setActionLoading(true);
    try {
      const res = await authFetch('/api/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: productionFormData.date,
          product_name: productionFormData.product_name,
          quantity_produced: parseInt(productionFormData.quantity_produced, 10),
          batch_code: productionFormData.batch_code,
          notes: productionFormData.notes
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '保存生产批次失败');
      }

      toast.success('曲奇生产批次已记录并自动计入库存');
      setIsProductionModalOpen(false);
      setProductionFormData(prev => ({
        ...prev,
        quantity_produced: '',
        batch_code: '',
        notes: ''
      }));
      fetchAllData();
    } catch (err) {
      toast.error(err.message || '保存生产记录失败');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Printable Letterhead for Tax Recordkeeping */}
      <div className={styles.printLetterhead}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#000' }}>ONEBITE COOKIES</h2>
        <p style={{ margin: '4px 0', fontSize: '0.9rem', color: '#333' }}>
          Malaysian Business & Tax Financial Records (Record Retention Compliance: Section 82 ITA 1967)
        </p>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#555' }}>
          Period: {formatMYDate(dateFrom)} 至 {formatMYDate(dateTo)} · Generated: {formatMYDate(today)}
        </p>
      </div>

      {/* Main Top Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1>📊 销售报表与税务存盘 (Sales & Tax Records)</h1>
          <p className={styles.subtitle}>
            OneBite Cookies 官方业务记账系统 · 马来西亚所得税法 (Section 82) 7年法定税务存盘合规
          </p>
        </div>

        <div className={styles.actionsArea}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => window.print()}
            title="打印或保存为高品质 PDF 报表"
          >
            🖨️ 打印 / 导出税务 PDF
          </button>

          {activeTab === 'sales' && (
            <button type="button" className={styles.btnPrimary} onClick={handleExportSales}>
              📥 导出销售报表 (Excel .xlsx)
            </button>
          )}

          {activeTab === 'expenses' && (
            <>
              <button type="button" className={styles.btnSuccess} onClick={() => setIsExpenseModalOpen(true)}>
                ➕ 记一笔支出
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleExportExpenses}>
                📥 导出支出报表 (Excel .xlsx)
              </button>
            </>
          )}

          {activeTab === 'pnl' && (
            <button type="button" className={styles.btnPrimary} onClick={handleExportPnL}>
              📥 导出损益与税表 (Excel .xlsx)
            </button>
          )}

          {activeTab === 'inventory' && (
            <>
              <button type="button" className={styles.btnSuccess} onClick={() => setIsProductionModalOpen(true)}>
                🍪 登记烘焙批次
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleExportInventory}>
                📥 导出库存报表 (Excel .xlsx)
              </button>
            </>
          )}

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={fetchAllData}
            disabled={loading}
            title="从数据库拉取最新数据"
          >
            🔄 刷新数据
          </button>
        </div>
      </div>

      {/* Date Filter Toolbar & 7-Year Historical Selector */}
      <div className={styles.toolbarCard}>
        <div className={styles.toolbarRow}>
          <div className={styles.yearPills}>
            <span className={styles.yearPillLabel}></span>
            <button
              type="button"
              className={`${styles.pillBtn} ${dateRangeMode === 'today' ? styles.pillBtnActive : ''}`}
              onClick={() => handlePresetDate('today')}
            >
              今日
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${dateRangeMode === 'yesterday' ? styles.pillBtnActive : ''}`}
              onClick={() => handlePresetDate('yesterday')}
            >
              昨日
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${dateRangeMode === 'month' ? styles.pillBtnActive : ''}`}
              onClick={() => handlePresetDate('month')}
            >
              本月 ({currentMonth})
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${dateRangeMode === 'last_month' ? styles.pillBtnActive : ''}`}
              onClick={() => handlePresetDate('last_month')}
            >
              上月
            </button>
            {/* 2026 First year operational selector */}
            <button
              type="button"
              className={`${styles.pillBtn} ${dateRangeMode === 'year' && selectedYear === '2026' ? styles.pillBtnActive : ''}`}
              onClick={() => handlePresetDate('year', '2026')}
            >
              2026年 (首年运营)
            </button>
            <button
              type="button"
              className={`${styles.pillBtn} ${dateRangeMode === 'all' ? styles.pillBtnActive : ''}`}
              onClick={() => handlePresetDate('all')}
            >
              全部记录 (All Time)
            </button>
          </div>

          <div className={styles.dateFilterGroup}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#553c2f' }}>自定义区间:</span>
            <input
              type="date"
              className={styles.dateInput}
              value={dateFrom}
              onChange={e => {
                setDateRangeMode('custom');
                setDateFrom(e.target.value);
              }}
            />
            <span style={{ color: '#888' }}>至</span>
            <input
              type="date"
              className={styles.dateInput}
              value={dateTo}
              onChange={e => {
                setDateRangeMode('custom');
                setDateTo(e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          id="tab-sales"
          className={`${styles.tabItem} ${activeTab === 'sales' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          📈 销售报表 (Sales Report)
        </button>
        <button
          type="button"
          id="tab-expenses"
          className={`${styles.tabItem} ${activeTab === 'expenses' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          🏷️ 支出与费用报表 (Expense Records)
        </button>
        <button
          type="button"
          id="tab-pnl"
          className={`${styles.tabItem} ${activeTab === 'pnl' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('pnl')}
        >
          ⚖️ 损益与LHDN所得税调整 (P&L & Tax Summary)
        </button>
        <button
          type="button"
          id="tab-inventory"
          className={`${styles.tabItem} ${activeTab === 'inventory' ? styles.tabItemActive : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          📦 原料采购与曲奇库存 (Inventory Records)
        </button>
      </div>

      {/* Loading state indicator */}
      {loading && <LoadingSpinner text="正在汇总实时财务数据..." />}

      {!loading && (
        <>
          {/* ========================================================
              TAB 1: SALES REPORT
             ======================================================== */}
          {activeTab === 'sales' && (
            <div>
              {/* Metrics Grid */}
              <div className={styles.metricsGrid}>
                <div className={`${styles.metricCard} ${styles.cardSales}`}>
                  <div className={styles.metricLabel}>已完成销售净额 (Net Paid Sales)</div>
                  <div className={styles.metricValue}>{formatMYR(salesTotals.net)}</div>
                  <div className={styles.metricSub}>
                    共 {salesTotals.count} 笔筛选记录 · 已售 {salesTotals.totalQty} 块曲奇
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardNet}`}>
                  <div className={styles.metricLabel}>营业总额 (Gross Cookie Sales)</div>
                  <div className={styles.metricValue}>{formatMYR(salesTotals.gross)}</div>
                  <div className={styles.metricSub}>
                    含优惠前曲奇总额 (不含配送与退款)
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardProfit}`}>
                  <div className={styles.metricLabel}>折扣与优惠券 (Total Discounts)</div>
                  <div className={styles.metricValue}>{formatMYR(salesTotals.discount)}</div>
                  <div className={styles.metricSub}>
                    从毛收入中扣除以计算真实营收入账
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardExpense}`}>
                  <div className={styles.metricLabel}>退款与取消 (Refunds & Deductions)</div>
                  <div className={styles.metricValue}>{formatMYR(salesTotals.refunds)}</div>
                  <div className={styles.metricSub}>
                    已妥善扣减，杜绝虚增与重复计入
                  </div>
                </div>
              </div>

              {/* Channel Sub-Navigation & Filters Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className={styles.channelNav} style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#553c2e', marginRight: '0.25rem' }}>
                    销售渠道分区:
                  </span>
                  <button
                    type="button"
                    className={`${styles.channelNavBtn} ${channelFilter === 'all' ? styles.channelNavBtnActive : ''}`}
                    onClick={() => setChannelFilter('all')}
                  >
                    🔘 全部渠道汇总 ({filteredSales.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.channelNavBtn} ${channelFilter === 'online' ? styles.channelNavBtnActive : ''}`}
                    onClick={() => setChannelFilter('online')}
                  >
                    🛒 线上预购订单 ({onlineSales.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.channelNavBtn} ${channelFilter === 'booth' ? styles.channelNavBtnActive : ''}`}
                    onClick={() => setChannelFilter('booth')}
                  >
                    🎪 集市摆摊销售 ({boothSales.length})
                  </button>
                  <button
                    type="button"
                    className={`${styles.channelNavBtn} ${channelFilter === 'supplier' ? styles.channelNavBtnActive : ''}`}
                    onClick={() => setChannelFilter('supplier')}
                  >
                    🏭 供应商与批发 ({supplierSales.length})
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="搜索单号 / 顾客 / 口味..."
                    className={styles.dateInput}
                    style={{ width: '180px' }}
                    value={salesSearch}
                    onChange={e => setSalesSearch(e.target.value)}
                  />

                  <select
                    className={styles.filterSelect}
                    value={paymentMethodFilter}
                    onChange={e => setPaymentMethodFilter(e.target.value)}
                  >
                    <option value="all">所有付款方式</option>
                    <option value="duitnow_qr">DuitNow QR</option>
                    <option value="bank_transfer">银行转账 (Bank)</option>
                    <option value="cash">现金 (Cash)</option>
                  </select>

                  <select
                    className={styles.filterSelect}
                    value={paymentStatusFilter}
                    onChange={e => setPaymentStatusFilter(e.target.value)}
                  >
                    <option value="all">所有付款状态</option>
                    <option value="completed">已付清 / 已验证 (Verified)</option>
                    <option value="pending">待付款 / 待审核 (Pending)</option>
                    <option value="refunded">已退款 (Refunded)</option>
                    <option value="cancelled">已取消 (Cancelled)</option>
                  </select>
                </div>
              </div>

              {/* ===================================================
                  SECTION 1: ONLINE ORDERS (线上预购订单)
                 =================================================== */}
              {(channelFilter === 'all' || channelFilter === 'online') && (
                <div className={styles.tableCard}>
                  <div className={styles.sectionBanner}>
                    <div>
                      <h4 className={styles.sectionBannerTitle}>
                        🛒 线上预购订单明细 (Online Pre-orders & Delivery)
                      </h4>
                      <p className={styles.sectionBannerSub}>
                        顾客网站在线自助下单、预购自取及 Lalamove / 管理员亲送订单记录
                      </p>
                    </div>
                    <div className={styles.sectionQuickStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>实收净额</span>
                        <span className={styles.statItemVal} style={{ color: '#1e3a8a' }}>{formatMYR(onlineTotals.net)}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>订单数</span>
                        <span className={styles.statItemVal}>{onlineTotals.count} 笔</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>已售出</span>
                        <span className={styles.statItemVal}>{onlineTotals.pieces} 块</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>代收运费</span>
                        <span className={styles.statItemVal} style={{ color: '#15803d' }}>+{formatMYR(onlineTotals.delivery)}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>折扣优惠</span>
                        <span className={styles.statItemVal} style={{ color: '#b91c1c' }}>-{formatMYR(onlineTotals.discount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>交易日期 (DD/MM/YYYY)</th>
                          <th>订单编号</th>
                          <th>顾客姓名与电话</th>
                          <th>订购口味与件数明细</th>
                          <th>总件数</th>
                          <th>折扣</th>
                          <th>配送费</th>
                          <th>实付总额</th>
                          <th>付款方式</th>
                          <th>付款状态</th>
                          <th>退款记录</th>
                          <th>转账凭证 / 单号</th>
                        </tr>
                      </thead>
                      <tbody>
                        {onlineSales.length === 0 ? (
                          <tr>
                            <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                              暂无符合条件的线上预购订单。
                            </td>
                          </tr>
                        ) : (
                          onlineSales.map((tx, idx) => (
                            <tr key={`online-${tx.rawId || tx.id}-${idx}`}>
                              <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMYDate(tx.date)}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3b2219' }}>{tx.id}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{tx.customerName}</div>
                                <div style={{ fontSize: '0.75rem', color: '#777' }}>{tx.phone}</div>
                              </td>
                              <td style={{ maxWidth: '240px', fontSize: '0.8rem', lineHeight: 1.3 }}>{tx.flavourSummary}</td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{tx.totalQuantity} 块</td>
                              <td style={{ color: tx.discount > 0 ? '#b91c1c' : '#888' }}>
                                {tx.discount > 0 ? `-${formatMYR(tx.discount)}` : '-'}
                              </td>
                              <td style={{ color: tx.deliveryFee > 0 ? '#15803d' : '#888' }}>
                                {tx.deliveryFee > 0 ? `+${formatMYR(tx.deliveryFee)}` : '-'}
                              </td>
                              <td style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.92rem' }}>
                                {formatMYR(tx.netAmount)}
                              </td>
                              <td>
                                <span className={styles.methodBadge}>
                                  {tx.paymentMethod.includes('cash')
                                    ? '💵 现金'
                                    : tx.paymentMethod.includes('bank')
                                      ? '🏦 银行转账'
                                      : '📱 DuitNow QR'}
                                </span>
                              </td>
                              <td>
                                {tx.isPaidCompleted ? (
                                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>已完成入账</span>
                                ) : tx.isRefunded ? (
                                  <span className={`${styles.badge} ${styles.badgeDanger}`}>已退款</span>
                                ) : tx.isCancelled ? (
                                  <span className={`${styles.badge} ${styles.badgeNeutral}`}>已取消</span>
                                ) : (
                                  <span className={`${styles.badge} ${styles.badgeWarning}`}>待确认/审核</span>
                                )}
                              </td>
                              <td style={{ color: tx.refundAmount > 0 ? '#b91c1c' : '#888' }}>
                                {tx.refundAmount > 0 ? formatMYR(tx.refundAmount) : '-'}
                              </td>
                              <td style={{ fontSize: '0.78rem', color: '#555', maxWidth: '140px', wordBreak: 'break-all' }}>
                                {tx.transactionRef}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {onlineSales.length > 0 && (
                        <tfoot className={styles.tfootSummary}>
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'right', paddingRight: '1rem' }}>
                              线上订单小计 (Online Subtotal):
                            </td>
                            <td style={{ textAlign: 'center' }}>{onlineTotals.pieces} 块</td>
                            <td style={{ color: '#b91c1c' }}>-{formatMYR(onlineTotals.discount)}</td>
                            <td style={{ color: '#15803d' }}>+{formatMYR(onlineTotals.delivery)}</td>
                            <td style={{ color: '#1e3a8a', fontSize: '0.98rem' }}>{formatMYR(onlineTotals.net)}</td>
                            <td colSpan={2}></td>
                            <td style={{ color: '#b91c1c' }}>{formatMYR(onlineTotals.refunds)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* ===================================================
                  SECTION 2: BOOTH SALES (集市摆摊销售)
                 =================================================== */}
              {(channelFilter === 'all' || channelFilter === 'booth') && (
                <div className={styles.tableCard}>
                  <div className={styles.sectionBanner}>
                    <div>
                      <h4 className={styles.sectionBannerTitle}>
                        🎪 集市摆摊销售明细 (Pop-up Market & Booth Sales)
                      </h4>
                      <p className={styles.sectionBannerSub}>
                        线下集市活动、大学快闪摊位现场 POS 收银及曲奇售卖盘点
                      </p>
                    </div>
                    <div className={styles.sectionQuickStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>集市入账</span>
                        <span className={styles.statItemVal} style={{ color: '#1e3a8a' }}>{formatMYR(boothTotals.net)}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>出摊场次</span>
                        <span className={styles.statItemVal}>{boothTotals.count} 场</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>售出总件数</span>
                        <span className={styles.statItemVal}>{boothTotals.pieces} 块</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>现场折扣</span>
                        <span className={styles.statItemVal} style={{ color: '#b91c1c' }}>-{formatMYR(boothTotals.discount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>出摊日期 (DD/MM/YYYY)</th>
                          <th>集市单号</th>
                          <th>集市地点 / 活动场地</th>
                          <th>现场备货与售出明细</th>
                          <th>售出总件数</th>
                          <th>销售毛额</th>
                          <th>现场折扣</th>
                          <th>实收金额</th>
                          <th>收款方式</th>
                          <th>结单状态</th>
                          <th>流水结算凭证</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boothSales.length === 0 ? (
                          <tr>
                            <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                              暂无符合条件的集市摆摊销售记录。
                            </td>
                          </tr>
                        ) : (
                          boothSales.map((tx, idx) => (
                            <tr key={`booth-${tx.rawId || tx.id}-${idx}`}>
                              <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMYDate(tx.date)}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3b2219' }}>{tx.id}</td>
                              <td style={{ fontWeight: 600, color: '#4a2818' }}>{tx.customerName}</td>
                              <td style={{ maxWidth: '280px', fontSize: '0.8rem', lineHeight: 1.3 }}>{tx.flavourSummary}</td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{tx.totalQuantity} 块</td>
                              <td style={{ color: '#555' }}>{formatMYR(tx.subtotal)}</td>
                              <td style={{ color: tx.discount > 0 ? '#b91c1c' : '#888' }}>
                                {tx.discount > 0 ? `-${formatMYR(tx.discount)}` : '-'}
                              </td>
                              <td style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.92rem' }}>
                                {formatMYR(tx.netAmount)}
                              </td>
                              <td>
                                <span className={styles.methodBadge}>📱 DuitNow QR / 现金</span>
                              </td>
                              <td>
                                <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                                  {tx.orderStatus === 'completed' ? '已结单入账' : '摆摊进行中'}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem', color: '#555' }}>{tx.transactionRef}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {boothSales.length > 0 && (
                        <tfoot className={styles.tfootSummary}>
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'right', paddingRight: '1rem' }}>
                              集市摆摊小计 (Booth Subtotal):
                            </td>
                            <td style={{ textAlign: 'center' }}>{boothTotals.pieces} 块</td>
                            <td>{formatMYR(boothTotals.gross)}</td>
                            <td style={{ color: '#b91c1c' }}>-{formatMYR(boothTotals.discount)}</td>
                            <td style={{ color: '#1e3a8a', fontSize: '0.98rem' }}>{formatMYR(boothTotals.net)}</td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* ===================================================
                  SECTION 3: SUPPLIER & WHOLESALE (供货商与批发合作)
                 =================================================== */}
              {(channelFilter === 'all' || channelFilter === 'supplier') && (
                <div className={styles.tableCard}>
                  <div className={styles.sectionBanner}>
                    <div>
                      <h4 className={styles.sectionBannerTitle}>
                        🏭 供应商与批发合作明细 (Supplier & Wholesale Partner Sales)
                      </h4>
                      <p className={styles.sectionBannerSub}>
                        咖啡厅、合作烘焙店、供货商大宗批量供货及 B2B 结算账单
                      </p>
                    </div>
                    <div className={styles.sectionQuickStats}>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>批发供货总额</span>
                        <span className={styles.statItemVal} style={{ color: '#3b2219' }}>{formatMYR(supplierTotals.invoiced)}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>已收账款</span>
                        <span className={styles.statItemVal} style={{ color: '#1e3a8a' }}>{formatMYR(supplierTotals.received)}</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>尚欠应收款</span>
                        <span className={styles.statItemVal} style={{ color: supplierTotals.outstanding > 0 ? '#b91c1c' : '#15803d' }}>
                          {formatMYR(supplierTotals.outstanding)}
                        </span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>合作商户</span>
                        <span className={styles.statItemVal}>{supplierTotals.count} 家</span>
                      </div>
                      <div className={styles.statItem}>
                        <span className={styles.statItemLabel}>供货曲奇</span>
                        <span className={styles.statItemVal}>{supplierTotals.pieces} 块</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.tableWrapper}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>供货日期 (DD/MM/YYYY)</th>
                          <th>批发单号</th>
                          <th>合作店铺 / 供货商名称</th>
                          <th>负责人电话</th>
                          <th>供货口味与数量明细</th>
                          <th>供货总件数</th>
                          <th>批发总额</th>
                          <th>优惠折扣</th>
                          <th>实收账款</th>
                          <th>尚欠应收款</th>
                          <th>结款状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierSales.length === 0 ? (
                          <tr>
                            <td colSpan={11} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                              暂无符合条件的供应商/批发供货记录。
                            </td>
                          </tr>
                        ) : (
                          supplierSales.map((tx, idx) => (
                            <tr key={`supplier-${tx.rawId || tx.id}-${idx}`}>
                              <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMYDate(tx.date)}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3b2219' }}>{tx.id}</td>
                              <td style={{ fontWeight: 700, color: '#3b2219' }}>{tx.customerName}</td>
                              <td style={{ color: '#666' }}>{tx.phone}</td>
                              <td style={{ maxWidth: '280px', fontSize: '0.8rem', lineHeight: 1.3 }}>{tx.flavourSummary}</td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>{tx.totalQuantity} 块</td>
                              <td style={{ color: '#555' }}>{formatMYR(tx.totalAmount)}</td>
                              <td style={{ color: tx.discount > 0 ? '#b91c1c' : '#888' }}>
                                {tx.discount > 0 ? `-${formatMYR(tx.discount)}` : '-'}
                              </td>
                              <td style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.92rem' }}>
                                {formatMYR(tx.netAmount)}
                              </td>
                              <td style={{ fontWeight: 700, color: (tx.outstanding || 0) > 0 ? '#b91c1c' : '#15803d' }}>
                                {(tx.outstanding || 0) > 0 ? formatMYR(tx.outstanding) : '已结清'}
                              </td>
                              <td>
                                {(tx.outstanding || 0) > 0 ? (
                                  <span className={`${styles.badge} ${styles.badgeWarning}`}>部分付款/未结清</span>
                                ) : (
                                  <span className={`${styles.badge} ${styles.badgeSuccess}`}>全额结清</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {supplierSales.length > 0 && (
                        <tfoot className={styles.tfootSummary}>
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'right', paddingRight: '1rem' }}>
                              批发供货小计 (Supplier & Wholesale Subtotal):
                            </td>
                            <td style={{ textAlign: 'center' }}>{supplierTotals.pieces} 块</td>
                            <td>{formatMYR(supplierTotals.invoiced)}</td>
                            <td></td>
                            <td style={{ color: '#1e3a8a', fontSize: '0.98rem' }}>{formatMYR(supplierTotals.received)}</td>
                            <td style={{ color: supplierTotals.outstanding > 0 ? '#b91c1c' : '#15803d' }}>
                              {formatMYR(supplierTotals.outstanding)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 2: EXPENSE REPORT
             ======================================================== */}
          {activeTab === 'expenses' && (
            <div>
              {/* Metrics Grid */}
              <div className={styles.metricsGrid}>
                <div className={`${styles.metricCard} ${styles.cardExpense}`}>
                  <div className={styles.metricLabel}>业务总支出 (Total Recorded Expenses)</div>
                  <div className={styles.metricValue}>{formatMYR(expenseTotals.total)}</div>
                  <div className={styles.metricSub}>
                    共 {expenseTotals.count} 项支出款项
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardNet}`}>
                  <div className={styles.metricLabel}>法定可全额抵税营运费用 (Deductible Revenue)</div>
                  <div className={styles.metricValue}>{formatMYR(expenseTotals.deductible)}</div>
                  <div className={styles.metricSub}>
                    食材原料、包装、厨房及摊位租金、配送等
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardTax}`}>
                  <div className={styles.metricLabel}>资本性设备购置 (Capital Expenditure)</div>
                  <div className={styles.metricValue}>{formatMYR(expenseTotals.capital)}</div>
                  <div className={styles.metricSub}>
                    烤箱、打蛋机、冷柜（按LHDN规则享有税收折旧）
                  </div>
                </div>
              </div>

              {/* Expense Table Card */}
              <div className={styles.tableCard}>
                <div className={styles.tableHeaderBar}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h3 className={styles.tableTitle}>
                      业务支出与发票记录
                      <span className={styles.tableCountBadge}>{filteredExpenses.length} 项支出</span>
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="搜索描述 / 供应商 / 类别..."
                      className={styles.dateInput}
                      style={{ width: '180px' }}
                      value={expenseSearch}
                      onChange={e => setExpenseSearch(e.target.value)}
                    />

                    <select
                      className={styles.filterSelect}
                      value={expenseCategoryFilter}
                      onChange={e => setExpenseCategoryFilter(e.target.value)}
                    >
                      <option value="all">所有支出分类 (All Categories)</option>
                      {LHDN_CATEGORIES.map(cat => (
                        <option key={cat.key} value={cat.key}>
                          {cat.labelZh}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className={styles.btnSuccess}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                      onClick={() => setIsExpenseModalOpen(true)}
                    >
                      ➕ 记一笔
                    </button>
                  </div>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>支出日期 (DD/MM/YYYY)</th>
                        <th>LHDN 税务分类</th>
                        <th>项目描述 / 用途</th>
                        <th>供应商 / 收款人</th>
                        <th>金额 (RM)</th>
                        <th>LHDN 税务性质</th>
                        <th>支付方式 / 付款人</th>
                        <th>发票/收据附件</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>
                            没有符合筛选条件的支出记录。
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((exp, idx) => (
                          <tr key={`${exp.id}-${idx}`}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                              {formatMYDate(exp.date)}
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: '#3b2219' }}>
                                {exp.categoryLabelZh}
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>
                              {exp.description}
                            </td>
                            <td style={{ color: '#555' }}>
                              {exp.supplierName || '-'}
                            </td>
                            <td style={{ fontWeight: 700, color: '#b91c1c', fontSize: '0.92rem' }}>
                              {formatMYR(exp.amount)}
                            </td>
                            <td>
                              {exp.isCapital ? (
                                <span className={`${styles.badge} ${styles.badgePurple}`} title="资本支出，按LHDN排表享有资本折旧 (CA)">
                                  🛠️ 资本设备 (享有CA)
                                </span>
                              ) : (
                                <span className={`${styles.badge} ${styles.badgeSuccess}`} title="常规营业开支，100%全额抵减应税所得">
                                  ✓ 全额抵税费用
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={styles.methodBadge}>
                                {exp.paymentMethod}
                              </span>
                            </td>
                            <td>
                              {exp.receiptUrl ? (
                                <button
                                  type="button"
                                  className={styles.btnSecondary}
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={() => setReceiptPreviewUrl(exp.receiptUrl)}
                                >
                                  📎 查看凭证
                                </button>
                              ) : (
                                <span style={{ color: '#aaa', fontSize: '0.78rem' }}>未上传</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: '#666', maxWidth: '160px' }}>
                              {exp.notes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredExpenses.length > 0 && (
                      <tfoot className={styles.tfootSummary}>
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'right', paddingRight: '1rem' }}>
                            总支出合计:
                          </td>
                          <td style={{ color: '#b91c1c', fontSize: '1rem' }}>
                            {formatMYR(expenseTotals.total)}
                          </td>
                          <td colSpan={4} style={{ fontSize: '0.8rem', color: '#555' }}>
                            常规营运: {formatMYR(expenseTotals.deductible)} · 资本设备: {formatMYR(expenseTotals.capital)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: P&L & LHDN TAX RECONCILIATION SUMMARY
             ======================================================== */}
          {activeTab === 'pnl' && (
            <div>
              {/* Financial Statement Grid */}
              <div className={styles.financialGrid}>
                {/* 1. Accounting Profit and Loss Card */}
                <div className={styles.statementCard}>
                  <h3 className={styles.statementTitle}>
                    <span>📈 商业损益总结表 (Profit & Loss Statement)</span>
                  </h3>

                  <div className={styles.statementRow}>
                    <span>曲奇营业毛额 (Gross Sales)</span>
                    <span style={{ fontWeight: 600 }}>{formatMYR(pnlSummary.grossSales)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowSub}`}>
                    <span>减: 折扣与优惠券 (Discounts & Vouchers)</span>
                    <span style={{ color: '#b91c1c' }}>-{formatMYR(pnlSummary.discounts)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowSub}`}>
                    <span>加: 代收客户配送费 (Delivery Fees Income)</span>
                    <span style={{ color: '#15803d' }}>+{formatMYR(pnlSummary.deliveryCharges)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowSub}`}>
                    <span>减: 订单退款 (Customer Refunds)</span>
                    <span style={{ color: '#b91c1c' }}>-{formatMYR(pnlSummary.refunds)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowHighlight}`}>
                    <span>营业净收入 (Net Business Revenue)</span>
                    <span style={{ color: '#1e3a8a', fontSize: '1.05rem' }}>{formatMYR(pnlSummary.netSales)}</span>
                  </div>

                  <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#7a5a48' }}>
                    营业费用明细 (Operating Costs & Expenses):
                  </div>

                  {LHDN_CATEGORIES.map(cat => {
                    const amt = pnlSummary.categoryExpenses[cat.key] || 0;
                    if (amt <= 0) return null;
                    return (
                      <div key={cat.key} className={`${styles.statementRow} ${styles.statementRowSub}`}>
                        <span>{cat.icon} {cat.labelZh}</span>
                        <span>{formatMYR(amt)}</span>
                      </div>
                    );
                  })}

                  <div className={`${styles.statementRow} ${styles.statementRowHighlight}`} style={{ marginTop: '0.75rem' }}>
                    <span>各项总成本支出 (Total Expenses)</span>
                    <span style={{ color: '#b91c1c', fontSize: '1.05rem' }}>-{formatMYR(pnlSummary.totalExpenses)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowFinal}`}>
                    <span>会计账面净利润 / 亏损 (Accounting Net Profit)</span>
                    <span>{formatMYR(pnlSummary.accountingProfit)}</span>
                  </div>
                </div>

                {/* 2. Malaysian LHDN Tax Adjustments Card */}
                <div className={styles.statementCard}>
                  <h3 className={styles.statementTitle}>
                    <span>🏛️ 马来西亚 LHDN 税务调整核算 (Tax Reconciliation)</span>
                  </h3>

                  <p style={{ fontSize: '0.82rem', color: '#6d4c3d', lineHeight: 1.4, margin: '0 0 1rem 0' }}>
                    根据马来西亚所得税法规（LHDN），企业购置的<strong>固定资产与设备</strong>（如烘焙烤箱、搅拌机、商业冷柜）在税法上属于资本支出，不可在发生当年全额作为营业费用扣除，必须在会计利润基础上<strong>加回 (Add Back)</strong>，并改依 Schedule 3 申请<strong>税收资本折旧 (Capital Allowance)</strong>。
                  </p>

                  <div className={styles.statementRow}>
                    <span>会计账面净利润 (Accounting Net Profit)</span>
                    <span style={{ fontWeight: 600 }}>{formatMYR(pnlSummary.accountingProfit)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowSub}`}>
                    <span>加回: 不可直接扣除之资本支出 (Add: Equipment Capital Add-Back)</span>
                    <span style={{ color: '#15803d', fontWeight: 600 }}>+{formatMYR(pnlSummary.capitalExpenditures)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowSub}`}>
                    <span>
                      减: 估算法定资本折旧 (Less: Estimated Capital Allowance 32%)
                      <br />
                      <small style={{ color: '#777' }}>初次折旧 20% + 年度折旧 12% (Schedule 3)</small>
                    </span>
                    <span style={{ color: '#b91c1c', fontWeight: 600 }}>-{formatMYR(pnlSummary.estimatedCapitalAllowance)}</span>
                  </div>

                  <div className={`${styles.statementRow} ${styles.statementRowFinalTax}`}>
                    <span>
                      估算法定应税所得 (Estimated Taxable Business Income)
                      <br />
                      <small style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#7e22ce' }}>
                        适用于 Form B / Form P 企业所得税报税填报
                      </small>
                    </span>
                    <span>{formatMYR(pnlSummary.taxableIncome)}</span>
                  </div>

                  <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#fef8f0', borderRadius: '8px', border: '1px solid #fed7aa' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#9a3412', marginBottom: '0.25rem' }}>
                      ⚠️ 税务存盘合规备忘 (Recordkeeping Notice)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: '#7c2d12', lineHeight: 1.5 }}>
                      <li>本功能专供企业日常记账、凭证归档与年度报税前期准备，并非直接向税收局自动报税系统。</li>
                      <li>请妥善保留所有纸质或电子版原始采购发票、电子收据及银行对账单至少 7 年。</li>
                      <li>独资/合伙企业伙伴的个人提款 (Drawings) 不属于可扣除费用，已在系统中独立区分。</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 4: INVENTORY & STOCK RECORD
             ======================================================== */}
          {activeTab === 'inventory' && (
            <div>
              {/* Metrics Grid */}
              <div className={styles.metricsGrid}>
                <div className={`${styles.metricCard} ${styles.cardNet}`}>
                  <div className={styles.metricLabel}>原料采购总支出 (Ingredients Purchased)</div>
                  <div className={styles.metricValue}>{formatMYR(inventoryStatus.totalIngredientsCost)}</div>
                  <div className={styles.metricSub}>
                    累计 {inventoryStatus.ingredientsCount} 笔采购记录 (面粉/黄油/巧克力等)
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardSales}`}>
                  <div className={styles.metricLabel}>曲奇烘焙生产总量 (Cookies Produced)</div>
                  <div className={styles.metricValue}>{inventoryStatus.totalProduced} 块</div>
                  <div className={styles.metricSub}>
                    涵盖日常生产批次及集市备货
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardExpense}`}>
                  <div className={styles.metricLabel}>累计已售出曲奇 (Total Cookies Sold)</div>
                  <div className={styles.metricValue}>{inventoryStatus.totalSold} 块</div>
                  <div className={styles.metricSub}>
                    涵盖线上预购、集市摆摊及批发
                  </div>
                </div>

                <div className={`${styles.metricCard} ${styles.cardProfit}`}>
                  <div className={styles.metricLabel}>当前剩余库存结存 (Remaining Stock)</div>
                  <div className={styles.metricValue}>{inventoryStatus.totalRemaining} 块</div>
                  <div className={styles.metricSub}>
                    预估库存资产货值: {formatMYR(inventoryStatus.inventoryList.reduce((s, i) => s + i.estimatedStockValue, 0))}
                  </div>
                </div>
              </div>

              {/* Cookie Inventory Balance Table */}
              <div className={styles.tableCard}>
                <div className={styles.tableHeaderBar}>
                  <h3 className={styles.tableTitle}>各口味曲奇生产与库存核算</h3>
                  <button
                    type="button"
                    className={styles.btnSuccess}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                    onClick={() => setIsProductionModalOpen(true)}
                  >
                    🍪 登记烘焙批次
                  </button>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>曲奇口味 (Flavour)</th>
                        <th>生产烘焙总量 (Produced)</th>
                        <th>已销售件数 (Sold)</th>
                        <th>试吃/损耗件数 (Wastage)</th>
                        <th>剩余现货结存 (Remaining)</th>
                        <th>单件建议零售价</th>
                        <th>预估库存资产货值</th>
                        <th>库存健康度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryStatus.inventoryList.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#888' }}>
                            暂无曲奇口味库存数据。
                          </td>
                        </tr>
                      ) : (
                        inventoryStatus.inventoryList.map((item, idx) => (
                          <tr key={`${item.productId || item.name}-${idx}`}>
                            <td style={{ fontWeight: 700, color: '#3b2219' }}>
                              🍪 {item.name}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                              {item.producedPieces} 块
                            </td>
                            <td style={{ textAlign: 'center', color: '#1e3a8a', fontWeight: 600 }}>
                              {item.soldPieces} 块
                            </td>
                            <td style={{ textAlign: 'center', color: '#b91c1c' }}>
                              {item.wastePieces} 块
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', color: item.remainingPieces > 0 ? '#15803d' : '#888' }}>
                              {item.remainingPieces} 块
                            </td>
                            <td style={{ textAlign: 'center', color: '#666' }}>
                              {formatMYR(item.unitPrice)}
                            </td>
                            <td style={{ fontWeight: 600, color: '#3b2219' }}>
                              {formatMYR(item.estimatedStockValue)}
                            </td>
                            <td>
                              {item.remainingPieces > 20 ? (
                                <span className={`${styles.badge} ${styles.badgeSuccess}`}>库存充裕</span>
                              ) : item.remainingPieces > 5 ? (
                                <span className={`${styles.badge} ${styles.badgeWarning}`}>低库存待补</span>
                              ) : (
                                <span className={`${styles.badge} ${styles.badgeDanger}`}>无现货/需烘焙</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className={styles.tfootSummary}>
                      <tr>
                        <td>汇总合计:</td>
                        <td style={{ textAlign: 'center' }}>{inventoryStatus.totalProduced} 块</td>
                        <td style={{ textAlign: 'center', color: '#1e3a8a' }}>{inventoryStatus.totalSold} 块</td>
                        <td></td>
                        <td style={{ textAlign: 'center', color: '#15803d', fontWeight: 800 }}>{inventoryStatus.totalRemaining} 块</td>
                        <td></td>
                        <td style={{ fontWeight: 700 }}>
                          {formatMYR(inventoryStatus.inventoryList.reduce((s, i) => s + i.estimatedStockValue, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Raw Ingredients Purchase History */}
              <div className={styles.tableCard}>
                <div className={styles.tableHeaderBar}>
                  <h3 className={styles.tableTitle}>原材料进货与采购明细 (Ingredients Purchase Log)</h3>
                </div>

                <div className={styles.tableWrapper}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>采购日期</th>
                        <th>原料描述 / 采购品项</th>
                        <th>供应商名称</th>
                        <th>金额 (RM)</th>
                        <th>支付方式</th>
                        <th>发票单据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryStatus.ingredientsPurchases.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                            暂无原料采购进货记录。
                          </td>
                        </tr>
                      ) : (
                        inventoryStatus.ingredientsPurchases.slice(0, 15).map((ing, idx) => (
                          <tr key={`${ing.id}-${idx}`}>
                            <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMYDate(ing.date)}</td>
                            <td style={{ fontWeight: 600 }}>{ing.description}</td>
                            <td>{ing.supplierName || '烘焙原料批发'}</td>
                            <td style={{ fontWeight: 700, color: '#b91c1c' }}>{formatMYR(ing.amount)}</td>
                            <td>{ing.paymentMethod}</td>
                            <td>
                              {ing.receiptUrl ? (
                                <button
                                  type="button"
                                  className={styles.btnSecondary}
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                  onClick={() => setReceiptPreviewUrl(ing.receiptUrl)}
                                >
                                  查看收据
                                </button>
                              ) : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================
          MODAL: ADD EXPENSE RECORD
         ======================================================== */}
      {isExpenseModalOpen && (
        <Modal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          title="记录业务支出与税收凭据 (New Expense Record)"
        >
          <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                支出日期 (Date) *
              </label>
              <input
                type="date"
                required
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={expenseFormData.date}
                onChange={e => setExpenseFormData({ ...expenseFormData, date: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                LHDN 税务支出分类 (Expense Category) *
              </label>
              <select
                required
                className={styles.filterSelect}
                style={{ width: '100%' }}
                value={expenseFormData.category}
                onChange={e => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
              >
                <option value="食材">🧈 食材原料 (Ingredients - 面粉/黄油/糖/巧克力)</option>
                <option value="包装">📦 包装耗材 (Packaging - 铁盒/纸盒/封口贴纸)</option>
                <option value="厨房租金">🍳 厨房租金 (Kitchen Rental)</option>
                <option value="摊位费">🎪 摊位费/摆摊场地 (Booth Rental)</option>
                <option value="配送相关">🛵 配送运费 (Delivery Charges)</option>
                <option value="广告物料">📢 广告营销/印刷物料 (Marketing & Promotion)</option>
                <option value="设备资产">🛠️ 设备资产购置 (Equipment - 烤箱/打蛋机/冷柜)</option>
                <option value="证书费用">📜 证书认证/卫生执照费 (Certificates & Licensing)</option>
                <option value="水电杂费">⚡ 水电燃气杂支 (Utilities)</option>
                <option value="银行手续费">💳 银行/DuitNow手续费 (Bank & Transaction Fees)</option>
                <option value="兼职人工费">👥 兼职小工人工费 (Part-time Wages)</option>
                <option value="其他">📎 其他日常杂支 (Other Operational Costs)</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  支出金额 (RM) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className={styles.dateInput}
                  style={{ width: '100%' }}
                  value={expenseFormData.amount}
                  onChange={e => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  付款方式 / 垫付人
                </label>
                <select
                  className={styles.filterSelect}
                  style={{ width: '100%' }}
                  value={expenseFormData.paid_by}
                  onChange={e => setExpenseFormData({ ...expenseFormData, paid_by: e.target.value })}
                >
                  <option value="公款账户">公款账户 (Company Fund)</option>
                  <option value="DuitNow QR">DuitNow QR 扫码支付</option>
                  <option value="银行转账">银行转账 (Bank Transfer)</option>
                  <option value="现金">现金 (Cash)</option>
                  <option value="Shinnie (垫付)">Shinnie (个人先行垫付)</option>
                  <option value="Yunxuan (垫付)">Yunxuan (个人先行垫付)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                支出描述 / 用途说明 (Description) *
              </label>
              <input
                type="text"
                required
                placeholder="例如: 采购法芙娜可可粉 5kg、购买曲奇铁盒 200 个"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={expenseFormData.description}
                onChange={e => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                供应商 / 开票单位 (Supplier Name)
              </label>
              <input
                type="text"
                placeholder="例如: Bake With Yen, Shopee, Lalamove"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={expenseFormData.supplierName}
                onChange={e => setExpenseFormData({ ...expenseFormData, supplierName: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                发票/收据附件链接 (Receipt / Invoice URL)
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... 或图片链接"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={expenseFormData.receiptUrl}
                onChange={e => setExpenseFormData({ ...expenseFormData, receiptUrl: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setIsExpenseModalOpen(false)}
              >
                取消
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={actionLoading}
              >
                {actionLoading ? '保存中...' : '确认存入支出记录'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================
          MODAL: LOG COOKIE PRODUCTION BATCH
         ======================================================== */}
      {isProductionModalOpen && (
        <Modal
          isOpen={isProductionModalOpen}
          onClose={() => setIsProductionModalOpen(false)}
          title="登记曲奇烘焙批次 (Log Cookie Production)"
        >
          <form onSubmit={handleSaveProduction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                烘焙生产日期 (Baking Date) *
              </label>
              <input
                type="date"
                required
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={productionFormData.date}
                onChange={e => setProductionFormData({ ...productionFormData, date: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                曲奇口味 (Flavour) *
              </label>
              <select
                required
                className={styles.filterSelect}
                style={{ width: '100%' }}
                value={productionFormData.product_name}
                onChange={e => setProductionFormData({ ...productionFormData, product_name: e.target.value })}
              >
                {products.filter(p => !p.is_byob).map(p => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                本次出炉/生产件数 (Pieces Produced) *
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="例如: 50"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={productionFormData.quantity_produced}
                onChange={e => setProductionFormData({ ...productionFormData, quantity_produced: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                生产批次号 (Batch Code - 可选)
              </label>
              <input
                type="text"
                placeholder="留空自动生成，例如: BATCH-20261012-01"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={productionFormData.batch_code}
                onChange={e => setProductionFormData({ ...productionFormData, batch_code: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                备注说明 (Notes)
              </label>
              <textarea
                rows={2}
                placeholder="例如: 周末集市备货，口感酥脆"
                className={styles.dateInput}
                style={{ width: '100%' }}
                value={productionFormData.notes}
                onChange={e => setProductionFormData({ ...productionFormData, notes: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setIsProductionModalOpen(false)}
              >
                取消
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={actionLoading}
              >
                {actionLoading ? '保存中...' : '登记入库'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================
          MODAL: RECEIPT PREVIEW
         ======================================================== */}
      {receiptPreviewUrl && (
        <Modal
          isOpen={Boolean(receiptPreviewUrl)}
          onClose={() => setReceiptPreviewUrl(null)}
          title="发票 / 收据凭证预览 (Receipt Preview)"
        >
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <img
              src={receiptPreviewUrl}
              alt="Receipt"
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', border: '1px solid #ddd' }}
              onError={(e) => {
                // If it's a Drive link or not directly renderable as img
                e.target.style.display = 'none';
                const fallback = document.getElementById('receipt-link-fallback');
                if (fallback) fallback.style.display = 'block';
              }}
            />
            <div id="receipt-link-fallback" style={{ display: 'none', margin: '1rem 0' }}>
              <p>无法直接在网页中嵌入该图片，请点击链接打开查看：</p>
              <a
                href={receiptPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnPrimary}
              >
                在新标签页打开凭证 ↗
              </a>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <a
                href={receiptPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnSecondary}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                在新标签页全屏查看 ↗
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
