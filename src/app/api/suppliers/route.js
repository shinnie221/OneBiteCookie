import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const suppliersRef = collection(db, 'suppliers');
    const snapshot = await getDocs(suppliersRef);
    let suppliers = [];

    snapshot.forEach(doc => {
      suppliers.push({ id: doc.id, ...doc.data() });
    });

    // Sort alphabetically by name
    suppliers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error('GET /api/suppliers error:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      contact,
      notes,
      status,
      minOrderQty,
      standardSupplyPrice,
      bulkThresholdQty,
      bulkSupplyPrice,
      agreedMinRetailPrice
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const newSupplier = {
      name: name.trim(),
      contact: (contact || '').trim(),
      notes: (notes || '').trim(),
      status: status || '合作中',
      minOrderQty: parseFloat(minOrderQty) || 40,
      standardSupplyPrice: parseFloat(standardSupplyPrice) || 4.80,
      bulkThresholdQty: parseFloat(bulkThresholdQty) || 100,
      bulkSupplyPrice: parseFloat(bulkSupplyPrice) || 4.40,
      agreedMinRetailPrice: parseFloat(agreedMinRetailPrice) || 7.90,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'suppliers'), newSupplier);

    return NextResponse.json({
      message: 'Supplier created successfully',
      id: docRef.id,
      supplier: { id: docRef.id, ...newSupplier }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/suppliers error:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
