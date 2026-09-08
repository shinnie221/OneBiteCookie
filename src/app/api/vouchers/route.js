import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const vouchersRef = collection(db, 'vouchers');
    const snapshot = await getDocs(vouchersRef);
    let vouchers = [];
    
    snapshot.forEach(doc => {
      vouchers.push({ id: doc.id, ...doc.data() });
    });
    
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
    
    const { 
      code, 
      discount_type, 
      discount_value, 
      min_order, 
      expiry_date, 
      active,
      is_public,
      usage_limit,
      target_type,
      customer_email,
      customer_name
    } = await request.json();
    
    if (!code || !discount_type || discount_value == null) {
      return NextResponse.json({ error: 'Code, type, and value are required' }, { status: 400 });
    }

    const upperCode = code.toUpperCase();
    
    const q = query(collection(db, 'vouchers'), where('code', '==', upperCode));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return NextResponse.json({ error: 'Voucher code already exists' }, { status: 400 });
    }

    await addDoc(collection(db, 'vouchers'), {
      code: upperCode,
      discount_type,
      discount_value,
      min_order: min_order || 0,
      expiry_date: expiry_date || null,
      active: active ? 1 : 0,
      is_public: is_public !== undefined ? Boolean(is_public) : true,
      usage_limit: usage_limit || 'unlimited',
      target_type: target_type || 'all',
      customer_email: customer_email ? customer_email.trim().toLowerCase() : null,
      customer_name: customer_name ? customer_name.trim() : null,
      times_used: 0,
      used_by: [],
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ message: 'Voucher created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/vouchers error:', error);
    return NextResponse.json({ error: 'Failed to create voucher' }, { status: 500 });
  }
}
