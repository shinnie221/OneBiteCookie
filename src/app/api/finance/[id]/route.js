import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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

export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const recordRef = doc(db, 'finance_records', id);
    const snapshot = await getDoc(recordRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Financial record not found' }, { status: 404 });
    }

    const existing = snapshot.data();

    let transactionType = body.transactionType ?? existing.transactionType;
    let category = body.category ?? existing.category;
    let date = body.date ?? existing.date;
    let amount = body.amount !== undefined ? parseFloat(body.amount) : existing.amount;
    let orderType = body.orderType ?? existing.orderType;
    let note = body.note !== undefined ? body.note : existing.note;
    let receiptUrl = body.receiptUrl !== undefined ? body.receiptUrl : existing.receiptUrl;
    let supplierName = body.supplierName !== undefined ? body.supplierName : existing.supplierName;

    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (amount !== undefined && (isNaN(amount) || amount < 0)) {
      return NextResponse.json({ error: 'Amount must be non-negative' }, { status: 400 });
    }

    // Rule: category === '样品/试吃损耗' forces transactionType === '支出'
    if (category === '样品/试吃损耗') {
      transactionType = '支出';
    }

    if (orderType && !VALID_ORDER_TYPES.includes(orderType)) {
      orderType = 'General';
    }

    const updates = {
      date: date.trim(),
      transactionType,
      category,
      amount: Math.round(amount * 100) / 100,
      orderType,
      note: (note || '').trim(),
      receiptUrl: (receiptUrl || '').trim(),
      supplierName: (supplierName || '').trim(),
      updated_at: new Date().toISOString()
    };

    await updateDoc(recordRef, updates);

    return NextResponse.json({ message: 'Record updated successfully', record: { id, ...existing, ...updates } });
  } catch (error) {
    console.error('PUT /api/finance/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update financial record' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const recordRef = doc(db, 'finance_records', id);
    const snapshot = await getDoc(recordRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Financial record not found' }, { status: 404 });
    }

    await deleteDoc(recordRef);

    return NextResponse.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/finance/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete financial record' }, { status: 500 });
  }
}
