import { rtdb as db } from '@/lib/firebase';
import { ref, get, push, set, query, orderByChild, equalTo } from 'firebase/database';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const snapshot = await get(ref(db, 'vouchers'));
    let vouchers = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      vouchers = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    }
    
    // Sort by descending created_at
    vouchers.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

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
    
    const { code, discount_type, discount_value, min_order, expiry_date, active } = await request.json();
    
    if (!code || !discount_type || discount_value == null) {
      return NextResponse.json({ error: 'Code, type, and value are required' }, { status: 400 });
    }

    const vouchersRef = ref(db, 'vouchers');
    const upperCode = code.toUpperCase();
    
    const snapshot = await get(vouchersRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const exists = Object.values(data).some(v => v.code === upperCode);
      if (exists) {
        return NextResponse.json({ error: 'Voucher code already exists' }, { status: 400 });
      }
    }

    const newVoucherRef = push(vouchersRef);
    await set(newVoucherRef, {
      code: upperCode,
      discount_type,
      discount_value,
      min_order: min_order || 0,
      expiry_date: expiry_date || null,
      active: active ? 1 : 0,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ message: 'Voucher created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/vouchers error:', error);
    return NextResponse.json({ error: 'Failed to create voucher' }, { status: 500 });
  }
}
