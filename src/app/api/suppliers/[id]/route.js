import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const supplierRef = doc(db, 'suppliers', id);
    const snapshot = await getDoc(supplierRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const existing = snapshot.data();

    const updates = {
      name: body.name !== undefined ? body.name.trim() : existing.name,
      contact: body.contact !== undefined ? (body.contact || '').trim() : existing.contact,
      notes: body.notes !== undefined ? (body.notes || '').trim() : existing.notes,
      status: body.status !== undefined ? body.status : existing.status,
      minOrderQty: body.minOrderQty !== undefined ? parseFloat(body.minOrderQty) : existing.minOrderQty,
      standardSupplyPrice: body.standardSupplyPrice !== undefined ? parseFloat(body.standardSupplyPrice) : existing.standardSupplyPrice,
      bulkThresholdQty: body.bulkThresholdQty !== undefined ? parseFloat(body.bulkThresholdQty) : existing.bulkThresholdQty,
      bulkSupplyPrice: body.bulkSupplyPrice !== undefined ? parseFloat(body.bulkSupplyPrice) : existing.bulkSupplyPrice,
      agreedMinRetailPrice: body.agreedMinRetailPrice !== undefined ? parseFloat(body.agreedMinRetailPrice) : existing.agreedMinRetailPrice,
      updated_at: new Date().toISOString()
    };

    if (!updates.name) {
      return NextResponse.json({ error: 'Supplier name cannot be empty' }, { status: 400 });
    }

    await updateDoc(supplierRef, updates);

    return NextResponse.json({ message: 'Supplier updated successfully', supplier: { id, ...existing, ...updates } });
  } catch (error) {
    console.error('PUT /api/suppliers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supplierRef = doc(db, 'suppliers', id);
    const snapshot = await getDoc(supplierRef);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await deleteDoc(supplierRef);

    return NextResponse.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/suppliers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
}
