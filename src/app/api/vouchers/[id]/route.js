import { getDb, queryOne, runStmt } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    const db = await getDb();
    const body = await request.json();
    
    const existing = queryOne(db, 'SELECT * FROM vouchers WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }
    
    const code = body.code !== undefined ? body.code.toUpperCase() : existing.code;
    const discountType = body.discount_type ?? existing.discount_type;
    const discountValue = body.discount_value ?? existing.discount_value;
    const minOrder = body.min_order ?? existing.min_order;
    const expiryDate = body.expiry_date !== undefined ? body.expiry_date : existing.expiry_date;
    const active = body.active !== undefined ? (body.active ? 1 : 0) : existing.active;
    
    runStmt(db,
      'UPDATE vouchers SET code=?, discount_type=?, discount_value=?, min_order=?, expiry_date=?, active=? WHERE id=?',
      [code, discountType, discountValue, minOrder, expiryDate, active, id]
    );
    
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
    const db = await getDb();
    
    runStmt(db, 'DELETE FROM vouchers WHERE id = ?', [id]);
    
    return NextResponse.json({ message: 'Voucher deleted' });
  } catch (error) {
    console.error('DELETE /api/vouchers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
}
