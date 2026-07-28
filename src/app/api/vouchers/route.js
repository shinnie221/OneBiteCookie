import { getDb, queryAll, queryOne, runStmt } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = await getDb();
    const vouchers = queryAll(db, 'SELECT * FROM vouchers ORDER BY id DESC');
    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error('GET /api/vouchers error:', error);
    return NextResponse.json({ error: 'Failed to fetch vouchers' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = await getDb();
    const { code, discount_type, discount_value, min_order, expiry_date, active } = await request.json();
    
    if (!code || !discount_type || discount_value == null) {
      return NextResponse.json({ error: 'Code, type, and value are required' }, { status: 400 });
    }

    // Check duplicate code
    const existing = queryOne(db, 'SELECT id FROM vouchers WHERE code = ?', [code.toUpperCase()]);
    if (existing) {
      return NextResponse.json({ error: 'Voucher code already exists' }, { status: 400 });
    }

    runStmt(db,
      'INSERT INTO vouchers (code, discount_type, discount_value, min_order, expiry_date, active) VALUES (?, ?, ?, ?, ?, ?)',
      [code.toUpperCase(), discount_type, discount_value, min_order || 0, expiry_date || null, active ? 1 : 0]
    );

    return NextResponse.json({ message: 'Voucher created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/vouchers error:', error);
    return NextResponse.json({ error: 'Failed to create voucher' }, { status: 500 });
  }
}
