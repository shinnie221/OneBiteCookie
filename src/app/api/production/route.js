import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user || !['staff', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const colRef = collection(db, 'production_records');
    const snapshot = await getDocs(colRef);
    const records = [];
    snapshot.forEach(docSnap => {
      records.push({ id: docSnap.id, ...docSnap.data() });
    });

    records.sort((a, b) => {
      const dateA = a.date || a.created_at || '';
      const dateB = b.date || b.created_at || '';
      return dateB.localeCompare(dateA);
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('GET /api/production error:', error);
    return NextResponse.json({ error: 'Failed to fetch production records' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = verifyAuth(request);
    if (!user || !['staff', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, product_name, quantity_produced, notes, batch_code, product_id } = body;

    if (!date) {
      return NextResponse.json({ error: 'Production date is required' }, { status: 400 });
    }
    if (!product_name || !product_name.trim()) {
      return NextResponse.json({ error: 'Cookie flavour/name is required' }, { status: 400 });
    }
    const qty = Number(quantity_produced);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Quantity produced must be a positive number' }, { status: 400 });
    }

    const newRecord = {
      date: date.trim(),
      product_name: product_name.trim(),
      product_id: product_id || null,
      quantity_produced: Math.round(qty),
      batch_code: (batch_code || '').trim() || `BATCH-${date.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
      notes: (notes || '').trim(),
      created_by: user.name || user.email || 'staff',
      created_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'production_records'), newRecord);

    return NextResponse.json({
      message: 'Production record logged successfully',
      id: docRef.id,
      record: { id: docRef.id, ...newRecord }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/production error:', error);
    return NextResponse.json({ error: 'Failed to create production record' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = verifyAuth(request);
    if (!user || !['staff', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    await deleteDoc(doc(db, 'production_records', id));
    return NextResponse.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/production error:', error);
    return NextResponse.json({ error: 'Failed to delete production record' }, { status: 500 });
  }
}
