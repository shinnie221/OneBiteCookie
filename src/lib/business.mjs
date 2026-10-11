// Shared, pure calculations: store prices on each record, never recalculate from the menu.
export function businessDate(value = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export const money = value => `RM${Number(value || 0).toFixed(2)}`;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
function text(value, label, required = false) {
    if (typeof value !== 'string' || value.length > 1000 || (required && !value.trim())) throw new Error(`${label} is required (maximum 1,000 characters).`);
    return value.trim();
}
function number(value, label, integer = false) {
    if (!['string', 'number'].includes(typeof value) || (typeof value === 'string' && !value.trim())) throw new Error(`${label} is required.`);
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 1000000 || (integer && !Number.isInteger(n))) throw new Error(`${label} must be a non-negative ${integer ? 'whole number' : 'number'} up to 1,000,000.`);
    return integer ? n : round(n);
}
export function normalizeBuyer(input) {
    return { name: text(input.name, 'Buyer name', true), contact: text(input.contact, 'Contact', true), notes: text(input.notes || '', 'Notes') };
}
export function normalizeBusinessRecord(input) {
    if (!['booth', 'wholesale'].includes(input.channel)) throw new Error('Choose booth or wholesale.');
    if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date) throw new Error('Enter a valid date.');
    const booth = input.channel === 'booth';
    const title = text(input.title, booth ? 'Booth name or location' : 'Buyer name', true);
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) throw new Error('Add between 1 and 100 flavours.');
    const boothStatus = booth ? (input.status === 'preparing' ? 'preparing' : 'completed') : undefined;
    const items = input.items.map(item => {
        const name = text(item.name, 'Flavour', true);
        const unitPrice = number(item.unitPrice, 'Price per piece');
        if (booth) {
            const prepared = number(item.prepared, 'Prepared pieces', true);
            const isPrep = boothStatus === 'preparing';
            const quantity = number(isPrep ? (item.quantity ?? 0) : (item.quantity ?? 0), 'Sold pieces', true);
            const waste = number(isPrep ? (item.waste ?? 0) : (item.waste ?? 0), 'Samples / waste', true);
            if (!isPrep && (quantity + waste > prepared)) {
                throw new Error(`${name}: sold pieces plus samples / waste cannot exceed prepared pieces.`);
            }
            const leftover = prepared - quantity - waste;
            return { name, quantity, unitPrice, prepared, waste, leftover, subtotal: round(quantity * unitPrice) };
        } else {
            const quantity = number(item.quantity, 'Pieces', true);
            if (!quantity) throw new Error('Wholesale quantities must be at least 1.');
            return { name, quantity, unitPrice, subtotal: round(quantity * unitPrice) };
        }
    });
    if (new Set(items.map(item => item.name.toLowerCase())).size !== items.length) throw new Error('Combine duplicate flavours into one row.');
    if (!Array.isArray(input.expenses) || input.expenses.length > 100) throw new Error('Expenses must be a list of up to 100 entries.');
    const expenses = input.expenses.map(e => ({ description: text(e.description, 'Expense description', true), amount: number(e.amount, 'Expense amount') }));
    const grossSales = round(items.reduce((sum, item) => sum + item.subtotal, 0));
    const discount = number(input.discount ?? 0, 'Total discount');
    if (discount > grossSales) throw new Error('Discount cannot exceed the cookie subtotal.');
    const sales = round(grossSales - discount);
    const expenseTotal = round(expenses.reduce((sum, e) => sum + e.amount, 0));
    const received = booth ? sales : number(input.received, 'Amount received');
    if (received > sales) throw new Error('Amount received cannot exceed the order total.');
    const result = { channel: input.channel, date: input.date, title, items, expenses, grossSales, discount, sales, expenseTotal, received, outstanding: round(sales - received), notes: text(input.notes || '', 'Notes') };
    if (booth) {
        result.status = boothStatus;
    } else {
        result.buyerId = text(input.buyerId, 'Buyer', true);
        result.contact = text(input.contact, 'Contact', true);
    }
    return result;
}

export function getOrderCompletionDate(order) {
    if (!order) return null;
    const status = order.order_status || order.status;
    if (status !== 'completed') return null;
    const dateVal = order.completed_at || order.updated_at || order.created_at;
    return dateVal ? businessDate(dateVal) : null;
}

export function getOrderCookieSales(order) {
    if (!order) return 0;
    let amount = Number(order.total ?? order.total_amount) || 0;
    // 管理员亲送的RM8配送费属于送货人个人补贴，不属于合伙公款，从销售营收中扣除
    // Lalamove的RM8配送费由finance_records作为收入记录单独核算配送收入，避免重复统计
    if (order.delivery_method === 'admin_delivery' || order.delivery_method === 'lalamove') {
        const fee = Number(order.delivery_fee) || 8;
        amount = Math.max(0, amount - fee);
    }
    return round(amount);
}

export function getBoothFinanceDates(financeRecords = []) {
    const set = new Set();
    if (Array.isArray(financeRecords)) {
        for (const r of financeRecords) {
            if (r.category === '摆摊支出' && r.orderType === 'Booth' && r.date) {
                set.add(r.date);
            }
        }
    }
    return set;
}

export function summarizeChannels(orders = [], records = [], from, to, financeRecords = []) {
    const inRange = date => date >= from && date <= to;
    const result = {
        preorder: 0,
        booth: 0,
        wholesale: 0,
        deliveryIncome: 0,
        financeIncome: 0,
        expenses: 0,
        boothExpenses: 0,
        wholesaleExpenses: 0,
        generalExpenses: 0,
        outstanding: 0,
        manualOrders: 0,
        orderPieces: 0,
        orderCount: 0,
        boothPieces: 0,
        boothCount: 0,
        wholesalePieces: 0,
        wholesaleCount: 0,
    };

    const boothFinanceDates = getBoothFinanceDates(financeRecords);

    // 1. Online Preorders
    if (Array.isArray(orders)) {
        for (const order of orders) {
            if (order.is_manual_order) { result.manualOrders++; continue; }
            const status = order.order_status || order.status;
            if (status !== 'completed') continue;
            const completionDate = getOrderCompletionDate(order);
            if (!completionDate || !inRange(completionDate)) continue;
            const isPaid = order.payment_status === 'verified' || !order.payment_status;
            if (isPaid) {
                result.orderCount++;
                const amount = getOrderCookieSales(order);
                result.preorder += amount;
                const pieces = order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
                result.orderPieces += pieces;
            }
        }
    }

    // 2. Channel Records (booth & wholesale)
    if (Array.isArray(records)) {
        for (const record of records) {
            if (!inRange(record.date) || !['booth', 'wholesale'].includes(record.channel)) continue;
            result[record.channel] += (record.sales || 0);

            if (record.channel === 'booth') {
                result.boothCount++;
                const soldPieces = record.items?.reduce((is, it) => is + (it.quantity || 0), 0) || 0;
                result.boothPieces += soldPieces;
                const boothExpense = boothFinanceDates.has(record.date) ? 0 : (record.expenseTotal || 0);
                result.boothExpenses += boothExpense;
                result.expenses += boothExpense;
            } else if (record.channel === 'wholesale') {
                result.wholesaleCount++;
                const pieces = record.items?.reduce((is, it) => is + (it.quantity || 0), 0) || 0;
                result.wholesalePieces += pieces;
                const wholesaleExpense = record.expenseTotal || 0;
                result.wholesaleExpenses += wholesaleExpense;
                result.expenses += wholesaleExpense;
                result.outstanding += (record.outstanding || 0);
            }
        }
    }

    // 3. Finance Records (Raw materials, packaging, operational costs, delivery income, etc.)
    if (Array.isArray(financeRecords)) {
        for (const item of financeRecords) {
            if (!item.date || !inRange(item.date)) continue;
            const amt = Number(item.amount) || 0;
            // 排除公款注资（资金池注资/充值，非营业收入或成本）
            if (item.transactionType === '公款注资' || item.category === '公款注资') {
                continue;
            }
            if (item.transactionType === '收入') {
                result.financeIncome += amt;
                if (item.category === '配送相关') {
                    result.deliveryIncome += amt;
                }
            } else {
                result.expenses += amt;
                result.generalExpenses += amt;
            }
        }
    }

    for (const key of ['preorder', 'booth', 'wholesale', 'deliveryIncome', 'financeIncome', 'expenses', 'boothExpenses', 'wholesaleExpenses', 'generalExpenses', 'outstanding']) {
        result[key] = round(result[key]);
    }
    result.totalPieces = result.orderPieces + result.boothPieces + result.wholesalePieces;
    result.total = round(result.preorder + result.booth + result.wholesale + result.financeIncome);
    result.net = round(result.total - result.expenses);
    return result;
}
