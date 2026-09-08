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
    
    const voucherRef = doc(db, 'vouchers', id);
    const snapshot = await getDoc(voucherRef);
    
    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }
    
    const existing = snapshot.data();
    
    const code = body.code !== undefined ? body.code.toUpperCase() : existing.code;
    const discountType = body.discount_type ?? existing.discount_type;
    const discountValue = body.discount_value ?? existing.discount_value;
    const minOrder = body.min_order ?? existing.min_order;
    const expiryDate = body.expiry_date !== undefined ? body.expiry_date : existing.expiry_date;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
    const isPublic = body.is_public !== undefined ? Boolean(body.is_public) : (existing.is_public !== undefined ? existing.is_public : true);
    const usageLimit = body.usage_limit !== undefined ? body.usage_limit : (existing.usage_limit || 'unlimited');
    
    await updateDoc(voucherRef, {
      code,
      discount_type: discountType,
      discount_value: discountValue,
      min_order: minOrder,
      expiry_date: expiryDate,
      active,
      is_public: isPublic,
      usage_limit: usageLimit
    });
    
    return NextResponse.json({ message: 'Voucher updated' });
  } catch (error) {
    console.error('PUT /api/vouchers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update voucher' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
    await deleteDoc(doc(db, 'vouchers', id));
    
    return NextResponse.json({ message: 'Voucher deleted' });
  } catch (error) {
    console.error('DELETE /api/vouchers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
}
