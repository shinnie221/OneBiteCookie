// Pure business calculations and helpers for Sales Report & Malaysian LHDN Tax Recordkeeping
import * as XLSX from 'xlsx';

export function formatMYDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const clean = String(dateStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // fallback
  }
  return String(dateStr);
}

export function formatMYR(amount) {
  const num = Number(amount || 0);
  return `RM${num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const LHDN_CATEGORIES = [
  { key: 'ingredients', labelZh: '食材原料 (Ingredients)', labelEn: 'Ingredients', deductible: true, icon: '🧈' },
  { key: 'packaging', labelZh: '包装耗材 (Packaging)', labelEn: 'Packaging', deductible: true, icon: '📦' },
  { key: 'kitchen_rental', labelZh: '厨房租金 (Kitchen Rental)', labelEn: 'Kitchen Rental', deductible: true, icon: '🍳' },
  { key: 'booth_rental', labelZh: '摊位费/摆摊支出 (Booth Rental)', labelEn: 'Booth Rental', deductible: true, icon: '🎪' },
  { key: 'delivery', labelZh: '配送费用 (Delivery)', labelEn: 'Delivery Charges', deductible: true, icon: '🛵' },
  { key: 'marketing', labelZh: '广告与营销 (Marketing)', labelEn: 'Marketing & Ads', deductible: true, icon: '📢' },
  { key: 'equipment', labelZh: '设备资产 (Equipment - 资本支出)', labelEn: 'Equipment & Machinery', deductible: false, isCapital: true, icon: '🛠️' },
  { key: 'utilities', labelZh: '水电杂费 (Utilities)', labelEn: 'Utilities', deductible: true, icon: '⚡' },
  { key: 'bank_fees', labelZh: '银行/支付手续费 (Bank Fees)', labelEn: 'Bank & Payment Fees', deductible: true, icon: '💳' },
  { key: 'wages', labelZh: '兼职人工费 (Part-time Wages)', labelEn: 'Wages & Helpers', deductible: true, icon: '👥' },
  { key: 'samples_loss', labelZh: '试吃与损耗 (Samples & Wastage)', labelEn: 'Samples & Wastage', deductible: true, icon: '🍪' },
  { key: 'other', labelZh: '其他日常杂支 (Other Expenses)', labelEn: 'Other Expenses', deductible: true, icon: '📎' },
];

export function mapToLhdnCategory(rawCat) {
  if (!rawCat) return 'other';
  const cat = String(rawCat).trim().toLowerCase();
  if (cat.includes('食材') || cat === 'ingredients' || cat.includes('supplier')) return 'ingredients';
  if (cat.includes('包装') || cat === 'packaging') return 'packaging';
  if (cat.includes('厨房') || cat === 'kitchen_rental') return 'kitchen_rental';
  if (cat.includes('摊位') || cat.includes('摆摊') || cat === 'booth_rental') return 'booth_rental';
  if (cat.includes('配送') || cat.includes('运费') || cat === 'delivery') return 'delivery';
  if (cat.includes('广告') || cat.includes('物料') || cat.includes('营销') || cat === 'marketing') return 'marketing';
  if (cat.includes('设备') || cat.includes('资产') || cat === 'equipment' || cat.includes('机械') || cat.includes('烤箱')) return 'equipment';
  if (cat.includes('水电') || cat.includes('燃气') || cat === 'utilities') return 'utilities';
  if (cat.includes('手续费') || cat.includes('银行') || cat === 'bank_fees') return 'bank_fees';
  if (cat.includes('兼职') || cat.includes('人工') || cat === 'wages') return 'wages';
  if (cat.includes('试吃') || cat.includes('损耗') || cat === 'samples_loss') return 'samples_loss';
  return 'other';
}

export function normalizeSalesTransactions(orders = [], businessRecords = []) {
  const transactions = [];

  // 1. Online & Manual Orders
  if (Array.isArray(orders)) {
    for (const order of orders) {
      const orderDate = order.created_at ? order.created_at.split('T')[0] : '';
      const orderId = order.order_id || order.id || '-';
      const customerName = order.customer_name || 'Customer';
      const phone = order.phone || '-';
      const isManual = Boolean(order.is_manual_order);
      const channel = isManual ? 'Manual POS' : 'Online Pre-order';
      
      const orderStatus = order.order_status || order.status || 'pending';
      const paymentStatus = order.payment_status || (orderStatus === 'completed' ? 'verified' : 'pending_verification');
      const isRefunded = orderStatus === 'refunded' || paymentStatus === 'refunded';
      const isCancelled = orderStatus === 'cancelled' || orderStatus === 'rejected';
      const isPaidCompleted = orderStatus === 'completed' && (paymentStatus === 'verified' || !order.payment_status);

      // Extract flavours, quantities, unit prices
      const itemsList = Array.isArray(order.items) ? order.items : [];
      const flavourSummary = itemsList.map(item => {
        const qty = Number(item.quantity || 1);
        const name = item.product_name || item.name || 'Cookie';
        const variant = item.variant ? ` (${item.variant})` : '';
        const price = Number(item.price || item.unit_price || 0);
        return `${name}${variant} x${qty} @ ${formatMYR(price)}`;
      }).join('; ');

      const totalQuantity = itemsList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      const subtotal = Number(order.subtotal || 0) || (itemsList.reduce((sum, item) => sum + (Number(item.subtotal) || (Number(item.price || 0) * Number(item.quantity || 0))), 0));
      const discount = Number(order.discount || order.manual_discount || 0);
      const deliveryFee = Number(order.delivery_fee || 0);
      const totalAmount = Number(order.total || order.total_amount || (subtotal - discount + deliveryFee));
      const refundAmount = isRefunded ? (Number(order.refund_amount) || totalAmount) : (Number(order.refund_amount) || 0);

      // Payment method
      let rawMethod = String(order.payment_method || '').toLowerCase();
      let paymentMethod = 'duitnow_qr';
      if (rawMethod.includes('cash') || rawMethod.includes('现金')) paymentMethod = 'cash';
      else if (rawMethod.includes('bank') || rawMethod.includes('transfer') || rawMethod.includes('转账')) paymentMethod = 'bank_transfer';
      else if (rawMethod.includes('qr') || rawMethod.includes('duitnow')) paymentMethod = 'duitnow_qr';

      const transactionRef = order.reference_number || order.bank_ref || order.transaction_ref || order.payment_proof_url ? (order.reference_number || order.bank_ref || 'Slip uploaded') : '-';

      transactions.push({
        id: orderId,
        rawId: order.id,
        source: 'orders',
        date: orderDate,
        customer: `${customerName} (${phone})`,
        customerName,
        phone,
        channel,
        flavourSummary: flavourSummary || 'Cookies',
        items: itemsList,
        totalQuantity,
        subtotal,
        discount,
        deliveryFee,
        totalAmount,
        refundAmount,
        netAmount: isPaidCompleted ? (totalAmount - refundAmount) : 0,
        paymentMethod,
        paymentStatus,
        orderStatus,
        isPaidCompleted,
        isRefunded,
        isCancelled,
        transactionRef,
        notes: order.staff_note || order.notes || '',
        created_at: order.created_at
      });
    }
  }

  // 2. Business Records: Booth & Wholesale
  if (Array.isArray(businessRecords)) {
    for (const record of businessRecords) {
      if (!record.date) continue;
      const isBooth = record.channel === 'booth';
      const itemsList = Array.isArray(record.items) ? record.items : [];
      const totalQuantity = itemsList.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      
      const flavourSummary = itemsList.map(item => {
        const qty = Number(item.quantity || 0);
        const name = item.name || 'Cookie';
        const price = Number(item.unitPrice || 0);
        return `${name} x${qty} @ ${formatMYR(price)}`;
      }).join('; ');

      const grossSales = Number(record.grossSales || itemsList.reduce((sum, it) => sum + (Number(it.subtotal) || (Number(it.unitPrice || 0) * Number(it.quantity || 0))), 0));
      const discount = Number(record.discount || 0);
      const netSales = Number(record.sales || (grossSales - discount));
      const received = isBooth ? netSales : Number(record.received || 0);
      const outstanding = Number(record.outstanding || (netSales - received));

      const isCompleted = isBooth ? (record.status !== 'preparing') : true;

      transactions.push({
        id: isBooth ? `BOOTH-${record.id}` : `WS-${record.id}`,
        rawId: record.id,
        source: 'business_records',
        date: record.date,
        customer: isBooth ? `🎪 集市摆摊: ${record.title}` : `🏭 批发合作: ${record.title} (${record.contact || '-'})`,
        customerName: record.title || 'Booth / Wholesale',
        phone: record.contact || '-',
        channel: isBooth ? 'Booth / Market' : 'Wholesale',
        flavourSummary: flavourSummary || 'Cookies',
        items: itemsList.map(it => ({
          product_name: it.name,
          quantity: it.quantity,
          price: it.unitPrice,
          subtotal: it.subtotal || (Number(it.quantity || 0) * Number(it.unitPrice || 0))
        })),
        totalQuantity,
        subtotal: grossSales,
        discount,
        deliveryFee: 0,
        totalAmount: netSales,
        refundAmount: 0,
        netAmount: received,
        outstanding,
        paymentMethod: isBooth ? 'duitnow_qr / cash' : 'bank_transfer',
        paymentStatus: outstanding > 0 ? 'partial_paid' : 'verified',
        orderStatus: isCompleted ? 'completed' : 'preparing',
        isPaidCompleted: isCompleted,
        isRefunded: false,
        isCancelled: false,
        transactionRef: isBooth ? 'POS Settlement' : `Wholesale Ref: ${record.buyerId || 'N/A'}`,
        notes: record.notes || '',
        created_at: record.created_at || record.date
      });
    }
  }

  // Sort by date descending
  transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return transactions;
}

export function normalizeExpenseRecords(financeRecords = []) {
  const expenses = [];
  if (!Array.isArray(financeRecords)) return expenses;

  for (const item of financeRecords) {
    if (!item.date) continue;
    // Skip equity capital injection
    if (item.transactionType === '公款注资' || item.category === '公款注资') continue;
    // Skip income records (e.g. delivery fee income)
    if (item.transactionType === '收入') continue;

    const lhdnKey = mapToLhdnCategory(item.category);
    const catMeta = LHDN_CATEGORIES.find(c => c.key === lhdnKey) || LHDN_CATEGORIES[LHDN_CATEGORIES.length - 1];
    const amount = Number(item.amount || 0);

    let paymentMethod = item.paid_by || item.payer || '公款账户';
    if (paymentMethod.includes('Shinnie') || paymentMethod.includes('Yunxuan')) {
      paymentMethod = `${paymentMethod} (个人垫付)`;
    }

    expenses.push({
      id: item.id || `EXP-${Math.random().toString(36).substring(2, 9)}`,
      date: item.date,
      categoryKey: lhdnKey,
      categoryLabelZh: catMeta.labelZh,
      categoryLabelEn: catMeta.labelEn,
      rawCategory: item.category,
      description: item.note || item.supplierName || item.category,
      supplierName: item.supplierName || '',
      amount,
      paymentMethod,
      claimStatus: item.claim_status || 'claimed',
      receiptUrl: item.receiptUrl || '',
      notes: item.note || '',
      isDeductible: catMeta.deductible,
      isCapital: Boolean(catMeta.isCapital),
      created_by: item.created_by || 'staff',
      created_at: item.created_at || item.date
    });
  }

  expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return expenses;
}

export function calculateProfitAndLoss(salesTransactions = [], expenseRecords = [], { from, to } = {}) {
  const inRange = date => {
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const filteredSales = salesTransactions.filter(tx => inRange(tx.date));
  const filteredExpenses = expenseRecords.filter(exp => inRange(exp.date));

  let grossSales = 0;
  let totalDiscounts = 0;
  let totalDeliveryCharges = 0;
  let totalRefunds = 0;
  let completedPaidSales = 0;
  let pendingSales = 0;
  let cancelledSales = 0;
  let totalPiecesSold = 0;
  let totalPaidOrders = 0;

  for (const tx of filteredSales) {
    if (tx.isPaidCompleted) {
      grossSales += (tx.subtotal || 0);
      totalDiscounts += (tx.discount || 0);
      totalDeliveryCharges += (tx.deliveryFee || 0);
      totalRefunds += (tx.refundAmount || 0);
      completedPaidSales += (tx.netAmount || 0);
      totalPiecesSold += (tx.totalQuantity || 0);
      totalPaidOrders++;
    } else if (tx.isRefunded) {
      totalRefunds += (tx.refundAmount || tx.totalAmount || 0);
    } else if (tx.isCancelled) {
      cancelledSales += (tx.totalAmount || 0);
    } else {
      pendingSales += (tx.totalAmount || 0);
    }
  }

  // Net Sales = Gross Sales - Discounts + Delivery Charges - Refunds
  const netSales = Math.max(0, grossSales - totalDiscounts + totalDeliveryCharges - totalRefunds);

  // Categorize Expenses
  const categoryExpenses = {};
  for (const cat of LHDN_CATEGORIES) {
    categoryExpenses[cat.key] = 0;
  }

  let totalExpenses = 0;
  let allowableExpenses = 0;
  let capitalExpenditures = 0; // Equipment, machinery

  for (const exp of filteredExpenses) {
    const amt = exp.amount || 0;
    totalExpenses += amt;
    if (categoryExpenses[exp.categoryKey] !== undefined) {
      categoryExpenses[exp.categoryKey] += amt;
    } else {
      categoryExpenses.other += amt;
    }

    if (exp.isCapital) {
      capitalExpenditures += amt;
    } else {
      allowableExpenses += amt;
    }
  }

  // Accounting Net Profit = Net Sales - Total Expenses
  const accountingProfit = netSales - totalExpenses;

  // Malaysian LHDN Tax Adjustments:
  // Under Malaysian LHDN Income Tax rules for businesses:
  // Capital expenditures (Equipment) are NOT fully expensed in the year of purchase.
  // Instead, they are added back, and Capital Allowance (CA) is claimed:
  // Estimated Initial Allowance (IA) = 20%, Annual Allowance (AA) = 12% (Total ~32% on plant/machinery/baking equipment).
  const estimatedCapitalAllowance = Math.round(capitalExpenditures * 0.32 * 100) / 100;
  const taxableIncome = accountingProfit + capitalExpenditures - estimatedCapitalAllowance;

  return {
    grossSales: Math.round(grossSales * 100) / 100,
    discounts: Math.round(totalDiscounts * 100) / 100,
    deliveryCharges: Math.round(totalDeliveryCharges * 100) / 100,
    refunds: Math.round(totalRefunds * 100) / 100,
    netSales: Math.round(netSales * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    allowableExpenses: Math.round(allowableExpenses * 100) / 100,
    capitalExpenditures: Math.round(capitalExpenditures * 100) / 100,
    accountingProfit: Math.round(accountingProfit * 100) / 100,
    estimatedCapitalAllowance,
    taxableIncome: Math.round(taxableIncome * 100) / 100,
    categoryExpenses,
    totalPiecesSold,
    totalPaidOrders,
    pendingSales: Math.round(pendingSales * 100) / 100,
    cancelledSales: Math.round(cancelledSales * 100) / 100,
  };
}

export function calculateInventoryStatus(products = [], productionRecords = [], salesTransactions = [], expenseRecords = []) {
  // 1. Ingredients Spent
  const ingredientsPurchases = expenseRecords.filter(e => e.categoryKey === 'ingredients');
  const totalIngredientsCost = ingredientsPurchases.reduce((sum, e) => sum + (e.amount || 0), 0);

  // 2. Map of cookie flavours
  const inventoryMap = {};

  // Initialize from products catalog
  for (const p of products) {
    if (p.is_byob) continue; // BYOB is a packaging container
    const name = p.name || 'Unnamed';
    inventoryMap[name] = {
      name,
      productId: p.id,
      producedPieces: 0,
      soldPieces: 0,
      wastePieces: 0,
      remainingPieces: 0,
      unitPrice: Number(p.price || 0)
    };
  }

  // Aggregate from production records
  for (const rec of productionRecords) {
    const name = rec.product_name;
    const qty = Number(rec.quantity_produced || 0);
    if (!inventoryMap[name]) {
      inventoryMap[name] = {
        name,
        productId: rec.product_id || null,
        producedPieces: 0,
        soldPieces: 0,
        wastePieces: 0,
        remainingPieces: 0,
        unitPrice: 0
      };
    }
    inventoryMap[name].producedPieces += qty;
  }

  // Aggregate from booth prepared batches & waste
  for (const tx of salesTransactions) {
    if (tx.source === 'business_records' && tx.items) {
      for (const it of tx.items) {
        const name = it.product_name;
        if (!name) continue;
        if (!inventoryMap[name]) {
          inventoryMap[name] = {
            name,
            productId: null,
            producedPieces: 0,
            soldPieces: 0,
            wastePieces: 0,
            remainingPieces: 0,
            unitPrice: Number(it.price || 0)
          };
        }
      }
    }
  }

  // Aggregate cookies sold
  for (const tx of salesTransactions) {
    if (!tx.isPaidCompleted && !tx.isRefunded) continue;
    if (Array.isArray(tx.items)) {
      for (const it of tx.items) {
        const rawName = it.product_name || it.name;
        if (!rawName) continue;
        const matchingKey = Object.keys(inventoryMap).find(k => k.toLowerCase() === rawName.toLowerCase()) || rawName;
        if (!inventoryMap[matchingKey]) {
          inventoryMap[matchingKey] = {
            name: matchingKey,
            productId: it.product_id || null,
            producedPieces: 0,
            soldPieces: 0,
            wastePieces: 0,
            remainingPieces: 0,
            unitPrice: Number(it.price || 0)
          };
        }
        const qty = Number(it.quantity || 0);
        // If variant has multiple pieces (e.g. box of 4, box of 6)
        const multiplier = Number(it.variant_pieces || 1);
        inventoryMap[matchingKey].soldPieces += (qty * multiplier);
      }
    }
  }

  // Calculate remaining stock
  const inventoryList = Object.values(inventoryMap).map(item => {
    const remaining = Math.max(0, item.producedPieces - item.soldPieces - item.wastePieces);
    return {
      ...item,
      remainingPieces: remaining,
      estimatedStockValue: Math.round(remaining * (item.unitPrice || 8.9) * 100) / 100
    };
  });

  return {
    totalIngredientsCost: Math.round(totalIngredientsCost * 100) / 100,
    ingredientsCount: ingredientsPurchases.length,
    ingredientsPurchases,
    inventoryList,
    totalProduced: inventoryList.reduce((sum, it) => sum + it.producedPieces, 0),
    totalSold: inventoryList.reduce((sum, it) => sum + it.soldPieces, 0),
    totalRemaining: inventoryList.reduce((sum, it) => sum + it.remainingPieces, 0),
  };
}

export function exportToCSV(filename, headers, rows) {
  // UTF-8 BOM so Excel opens Malay, Chinese, and symbols cleanly
  const BOM = '\uFEFF';
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(val => {
      const cleanVal = val === null || val === undefined ? '' : String(val);
      return `"${cleanVal.replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\r\n');

  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(filename, sheetName, headers, rows) {
  try {
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Auto-fit column widths
    const colWidths = headers.map((header, colIdx) => {
      let maxLen = String(header).length;
      for (const row of rows) {
        const val = row[colIdx];
        if (val !== undefined && val !== null) {
          const len = String(val).length;
          if (len > maxLen) maxLen = len;
        }
      }
      return { wch: Math.min(Math.max(maxLen + 4, 12), 48) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Report').slice(0, 31));
    
    const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
    return true;
  } catch (err) {
    console.error('XLSX export error, falling back to CSV:', err);
    exportToCSV(filename, headers, rows);
    return false;
  }
}

export function exportMultiSheetExcel(filename, sheets = []) {
  try {
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
      const data = [sheet.headers, ...sheet.rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const colWidths = sheet.headers.map((header, colIdx) => {
        let maxLen = String(header).length;
        for (const row of sheet.rows) {
          const val = row[colIdx];
          if (val !== undefined && val !== null) {
            const len = String(val).length;
            if (len > maxLen) maxLen = len;
          }
        }
        return { wch: Math.min(Math.max(maxLen + 4, 12), 48) };
      });
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, (sheet.sheetName || 'Sheet').slice(0, 31));
    }
    const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, cleanFilename);
    return true;
  } catch (err) {
    console.error('Multi-sheet export error, falling back to CSV:', err);
    if (sheets[0]) exportToCSV(filename, sheets[0].headers, sheets[0].rows);
    return false;
  }
}
