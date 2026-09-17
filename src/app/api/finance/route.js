import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const VALID_CATEGORIES = [
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

const VALID_ORDER_TYPES = ['Pre-order', 'Booth', 'General'];

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

    if (!transactionType || !['收入', '支出'].includes(transactionType)) {
      return NextResponse.json({ error: 'Transaction type must be 收入 or 支出' }, { status: 400 });
    }

    if (!category || !VALID_CATEGORIES.includes(category)) {
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

    const newRecord = {
      date: date.trim(),
      transactionType,
      category,
      amount: Math.round(numericAmount * 100) / 100,
      orderType,
      note: (note || '').trim(),
      receiptUrl: (receiptUrl || '').trim(),
      supplierName: (supplierName || '').trim(),
      created_by: user.name || user.email || 'staff',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

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
