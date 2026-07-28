import { getDb, queryOne } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const db = await getDb();
    const { code, subtotal } = await request.json();
    
    if (!code) {
      return NextResponse.json({ error: 'Voucher code is required', valid: false }, { status: 400 });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const voucher = queryOne(db, 
      "SELECT * FROM vouchers WHERE code = ? AND active = 1 AND (expiry_date IS NULL OR expiry_date >= ?)",
      [code.toUpperCase(), today]
    );

    if (!voucher) {
      return NextResponse.json({ error: 'Invalid or expired voucher code', valid: false }, { status: 400 });
    }

    if (subtotal < voucher.min_order) {
      return NextResponse.json({ 
        error: `Minimum order of RM${voucher.min_order.toFixed(2)} required for this voucher`, 
        valid: false 
      }, { status: 400 });
    }

    // Calculate discount
    let discountAmount = 0;
    if (voucher.discount_type === 'percentage') {
      discountAmount = subtotal * (voucher.discount_value / 100);
    } else {
      discountAmount = voucher.discount_value;
    }
    discountAmount = Math.min(discountAmount, subtotal);

    return NextResponse.json({
      valid: true,
      voucher: {
        ...voucher,
        discount_amount: discountAmount
      }
    });
  } catch (error) {
    console.error('POST /api/vouchers/validate error:', error);
    return NextResponse.json({ error: 'Failed to validate voucher', valid: false }, { status: 500 });
  }
}
