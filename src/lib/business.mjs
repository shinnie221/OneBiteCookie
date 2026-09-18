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

export function summarizeChannels(orders, records, from, to, financeRecords = []) {
    const inRange = date => date >= from && date <= to;
    const result = { preorder: 0, booth: 0, wholesale: 0, expenses: 0, outstanding: 0, manualOrders: 0, generalExpenses: 0 };
    for (const order of orders) {
        if (order.is_manual_order) { result.manualOrders++; continue; }
        const status = order.order_status || order.status;
        if (status !== 'completed') continue;
        const completionDate = getOrderCompletionDate(order);
        if (!completionDate || !inRange(completionDate)) continue;
        if (order.payment_status === 'verified') {
            result.preorder += Number(order.total ?? order.total_amount) || 0;
        }
    }
    for (const record of records) {
        if (!inRange(record.date) || !['booth', 'wholesale'].includes(record.channel)) continue;
        result[record.channel] += record.sales;
        result.expenses += record.expenseTotal;
        result.outstanding += record.outstanding;
    }
    if (Array.isArray(financeRecords)) {
        for (const item of financeRecords) {
            if (!item.date || !inRange(item.date)) continue;
            if (item.transactionType === '支出' || !item.transactionType) {
                const amt = Number(item.amount) || 0;
                result.expenses += amt;
                result.generalExpenses += amt;
            }
        }
    }
    for (const key of ['preorder', 'booth', 'wholesale', 'expenses', 'outstanding', 'generalExpenses']) result[key] = round(result[key]);
    result.total = round(result.preorder + result.booth + result.wholesale);
    result.net = round(result.total - result.expenses);
    return result;
}
