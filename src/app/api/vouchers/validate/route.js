import { rtdb as db } from '@/lib/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { code, subtotal } = await request.json();
    
    if (!code) {
      return NextResponse.json({ error: 'Voucher code is required', valid: false }, { status: 400 });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    const vouchersRef = ref(db, 'vouchers');
    const voucherQuery = query(vouchersRef, orderByChild('code'), equalTo(code.toUpperCase()));
    const snapshot = await get(voucherQuery);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Invalid or expired voucher code', valid: false }, { status: 400 });
    }

    const vouchersData = snapshot.val();
    const vKey = Object.keys(vouchersData)[0];
    const voucher = { id: vKey, ...vouchersData[vKey] };

    const active = voucher.active === 1 || voucher.active === true;
    const notExpired = !voucher.expiry_date || voucher.expiry_date >= today;

    if (!active || !notExpired) {
      return NextResponse.json({ error: 'Invalid or expired voucher code', valid: false }, { status: 400 });
    }

    if (subtotal < voucher.min_order) {
      return NextResponse.json({ 
        error: `Minimum order of RM${Number(voucher.min_order).toFixed(2)} required for this voucher`, 
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
