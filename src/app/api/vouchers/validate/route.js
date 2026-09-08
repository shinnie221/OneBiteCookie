import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { code, subtotal } = await request.json();
    
    if (!code) {
      return NextResponse.json({ error: 'Voucher code is required', valid: false }, { status: 400 });
    }

    let user = null;
    try {
      user = verifyAuth(request);
    } catch (e) {
      // Unauthenticated
    }
    
    const today = new Date().toISOString().split('T')[0];
    const upperCode = code.trim().toUpperCase();
    
    const q = query(collection(db, 'vouchers'), where('code', '==', upperCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Invalid voucher code', valid: false }, { status: 400 });
    }

    const docSnap = snapshot.docs[0];
    const voucher = { id: docSnap.id, ...docSnap.data() };

    const active = voucher.active === 1 || voucher.active === true;
    const notExpired = !voucher.expiry_date || voucher.expiry_date >= today;

    if (!active || !notExpired) {
      return NextResponse.json({ error: 'Invalid or expired voucher code', valid: false }, { status: 400 });
    }

    // Check usage limits
    const usageLimit = voucher.usage_limit || 'unlimited';

    // 1. Single-Use Total: Can only be used 1 time by anyone
    if (usageLimit === 'once_total') {
      if ((voucher.times_used || 0) >= 1) {
        return NextResponse.json({ 
          error: 'This single-use voucher has already been redeemed', 
          valid: false 
        }, { status: 400 });
      }
    }

    // 2. Once Per Customer: Each customer can only use it once
    if (usageLimit === 'once_per_customer') {
      if (user) {
        const usedBy = Array.isArray(voucher.used_by) ? voucher.used_by : [];
        const alreadyUsed = usedBy.includes(user.id) || (user.email && usedBy.includes(user.email));

        if (alreadyUsed) {
          return NextResponse.json({ 
            error: 'You have already used this voucher before', 
            valid: false 
          }, { status: 400 });
        }

        // Also check prior orders as safeguard
        const orderQ = query(
          collection(db, 'orders'),
          where('voucher_code', '==', upperCode),
          where('customer_id', '==', user.id)
        );
        const orderSnap = await getDocs(orderQ);
        const validPriorOrders = orderSnap.docs.filter(d => {
          const st = d.data().order_status;
          return st !== 'cancelled' && st !== 'rejected';
        });

        if (validPriorOrders.length > 0) {
          return NextResponse.json({ 
            error: 'You have already used this voucher on a previous order', 
            valid: false 
          }, { status: 400 });
        }
      }
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
