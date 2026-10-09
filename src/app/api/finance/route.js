import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, runTransaction } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const VALID_CATEGORIES = [
  '食材',
  '包装',
  '厨房租金',
  '摆摊支出',
  '摊位费',
  '兼职人工费',
  '配送相关',
  '广告物料',
  '样品/试吃损耗',
  '内部个人采购',
  'Supplier采购',
  '公款注资',
  '其他'
];

const VALID_ORDER_TYPES = ['Pre-order', 'Booth', 'Wholesale', 'General'];

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderType = searchParams.get('orderType');
    const supplierName = searchParams.get('supplierName');
    const month = searchParams.get('month'); // format: YYYY-MM

    const financeRef = collection(db, 'finance_records');
    const snapshot = await getDocs(financeRef);
    let records = [];

    snapshot.forEach(doc => {
      records.push({ id: doc.id, ...doc.data() });
    });

    // In-memory filters
    if (orderType && orderType !== 'all') {
      records = records.filter(r => r.orderType === orderType);
    }

    if (supplierName && supplierName !== 'all') {
      records = records.filter(r => (r.supplierName || '').trim().toLowerCase() === supplierName.trim().toLowerCase());
    }

    if (month && month !== 'all') {
      records = records.filter(r => (r.date || '').startsWith(month));
    }

    // Sort by date descending, then created_at descending
    records.sort((a, b) => {
      const dateDiff = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('GET /api/finance error:', error);
    return NextResponse.json({ error: 'Failed to fetch financial records' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    let {
      date,
      transactionType,
      category,
      amount,
      orderType,
      note,
      receiptUrl,
      supplierName
    } = body;

    // Validations
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    if (!transactionType || !['收入', '支出', '公款注资'].includes(transactionType)) {
      return NextResponse.json({ error: 'Transaction type must be 收入, 支出 or 公款注资' }, { status: 400 });
    }

    if (transactionType === '公款注资') {
      category = '公款注资';
    } else if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category selected' }, { status: 400 });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return NextResponse.json({ error: 'Amount must be a non-negative number' }, { status: 400 });
    }

    // Rule: category === '样品/试吃损耗' forces transactionType === '支出'
    if (category === '样品/试吃损耗') {
      transactionType = '支出';
    }

    if (!orderType || !VALID_ORDER_TYPES.includes(orderType)) {
      orderType = 'General';
    }

    // Claim and payer fields
    const paidBy = body.paid_by || body.payer || (transactionType === '公款注资' ? (body.contributor || '合伙人') : '公款账户');
    const claimStatus = transactionType === '公款注资' 
      ? 'not_applicable' 
      : (body.claim_status || (paidBy === '公款账户' ? 'claimed' : 'pending'));
    const claimedAt = claimStatus === 'claimed' ? (body.claimed_at || new Date().toISOString()) : null;

    const newRecord = {
      date: date.trim(),
      transactionType,
      category,
      amount: Math.round(numericAmount * 100) / 100,
      orderType,
      note: (note || '').trim(),
      receiptUrl: (receiptUrl || '').trim(),
      supplierName: (supplierName || '').trim(),
      payer: paidBy,
      paid_by: paidBy,
      contributor: body.contributor || (transactionType === '公款注资' ? paidBy : null),
      claim_status: claimStatus,
      claimed_at: claimedAt,
      extra_amount: body.extra_amount !== undefined ? Number(body.extra_amount) : null,
      linked_order_id: body.linked_order_id || null,
      auto_generated: Boolean(body.auto_generated),
      record_sub_type: body.record_sub_type || null,
      created_by: user.name || user.email || 'staff',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Idempotency: a client_ref (e.g. from the booth POS) is used as the document id so that
    // double taps / network retries can never create the same expense twice.
    const clientRef = typeof body.client_ref === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(body.client_ref) ? body.client_ref : null;
    if (clientRef) {
      const ref = doc(db, 'finance_records', clientRef);
      const { created, data } = await runTransaction(db, async transaction => {
        const existing = await transaction.get(ref);
        if (existing.exists()) return { created: false, data: existing.data() };
        transaction.set(ref, { ...newRecord, client_ref: clientRef });
        return { created: true, data: { ...newRecord, client_ref: clientRef } };
      });
      return NextResponse.json({
        message: created ? 'Financial record created successfully' : 'Duplicate submission ignored',
        id: clientRef,
        duplicate: !created,
        record: { id: clientRef, ...data }
      }, { status: created ? 201 : 200 });
    }

    const docRef = await addDoc(collection(db, 'finance_records'), newRecord);

    return NextResponse.json({
      message: 'Financial record created successfully',
      id: docRef.id,
      record: { id: docRef.id, ...newRecord }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/finance error:', error);
    return NextResponse.json({ error: 'Failed to create financial record' }, { status: 500 });
  }
}
