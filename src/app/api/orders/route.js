import { rtdb as db } from '@/lib/firebase';
import { ref, get, push, set, update, query, orderByChild, equalTo, child } from 'firebase/database';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

function generateOrderId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `OB-${y}${m}${d}-${rand}`;
}

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const ordersRef = ref(db, 'orders');
    let snapshot;
    
    // Customer can only see their own orders
    if (user.role === 'customer') {
      const customerQuery = query(ordersRef, orderByChild('customer_id'), equalTo(user.id));
      snapshot = await get(customerQuery);
    } else {
      snapshot = await get(ordersRef);
    }

    let orders = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      orders = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
    }

    // Filter by status and date in memory since Firebase Realtime Database has limited multi-field querying
    if (status && status !== 'all') {
      if (status === 'accepted') {
        const acceptedStatuses = ['accepted', 'preparing', 'ready_pickup', 'out_delivery'];
        orders = orders.filter(o => acceptedStatuses.includes(o.order_status));
      } else {
        orders = orders.filter(o => o.order_status === status);
      }
    }

    if (dateFrom) {
      orders = orders.filter(o => {
        const oDate = o.created_at ? o.created_at.split('T')[0] : '';
        return oDate >= dateFrom;
      });
    }
    if (dateTo) {
      orders = orders.filter(o => {
        const oDate = o.created_at ? o.created_at.split('T')[0] : '';
        return oDate <= dateTo;
      });
    }

    // Sort by descending created_at
    orders.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customer_name, phone, email, order_type, address, items, voucher_code, payment_screenshot } = body;

    if (!customer_name || !phone || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone, and items are required' }, { status: 400 });
    }

    let subtotal = 0;
    const resolvedItems = [];
    
    for (const item of items) {
      const productSnapshot = await get(child(ref(db), `products/${item.product_id}`));
      
      if (!productSnapshot.exists()) {
        return NextResponse.json({ error: `Product "${item.product_name}" is no longer available` }, { status: 400 });
      }
      
      const product = productSnapshot.val();
      
      if (product.available === false || product.available === 0) {
        return NextResponse.json({ error: `Product "${item.product_name}" is no longer available` }, { status: 400 });
      }
      
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for "${product.name}". Only ${product.stock} available.` }, { status: 400 });
      }
      
      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;
      
      resolvedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
        subtotal: itemSubtotal
      });
    }

    let discount = 0;
    if (voucher_code) {
      const today = new Date().toISOString().split('T')[0];
      const voucherQuery = query(ref(db, 'vouchers'), orderByChild('code'), equalTo(voucher_code.toUpperCase()));
      const voucherSnapshot = await get(voucherQuery);
      
      if (voucherSnapshot.exists()) {
        const vouchersData = voucherSnapshot.val();
        const vKey = Object.keys(vouchersData)[0];
        const voucher = vouchersData[vKey];
        
        const active = voucher.active === 1 || voucher.active === true;
        const notExpired = !voucher.expiry_date || voucher.expiry_date >= today;
        
        if (active && notExpired && subtotal >= voucher.min_order) {
          if (voucher.discount_type === 'percentage') {
            discount = subtotal * (voucher.discount_value / 100);
          } else {
            discount = voucher.discount_value;
          }
          discount = Math.min(discount, subtotal);
        }
      }
    }

    const total = Math.max(0, subtotal - discount);
    const orderId = generateOrderId();
    const createdAt = new Date().toISOString();

    const newOrderRef = push(ref(db, 'orders'));
    
    const newOrder = {
      order_id: orderId,
      customer_id: user.id,
      customer_name,
      phone,
      email: email || '',
      order_type: order_type || 'pickup',
      address: address || '',
      subtotal,
      discount,
      total,
      voucher_code: voucher_code || null,
      payment_screenshot: payment_screenshot || null,
      payment_status: 'pending',
      order_status: 'pending_verification',
      items: resolvedItems,
      created_at: createdAt
    };

    await set(newOrderRef, newOrder);

    // Deduct stock
    for (const item of resolvedItems) {
      const productRef = child(ref(db), `products/${item.product_id}`);
      const snap = await get(productRef);
      if (snap.exists()) {
        const prod = snap.val();
        await update(productRef, { stock: prod.stock - item.quantity });
      }
    }

    return NextResponse.json({
      message: 'Order placed successfully',
      order: { id: newOrderRef.key, ...newOrder }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
