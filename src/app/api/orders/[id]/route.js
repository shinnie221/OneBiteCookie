import { db } from '@/lib/firebase';
import { ref, get, update, query, orderByChild, equalTo } from 'firebase/database';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    
    const ordersRef = ref(db, 'orders');
    const orderQuery = query(ordersRef, orderByChild('order_id'), equalTo(id.toUpperCase()));
    const snapshot = await get(orderQuery);
    
    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const data = snapshot.val();
    const orderKey = Object.keys(data)[0];
    const order = { id: orderKey, ...data[orderKey] };

    if (user.role === 'customer' && order.customer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('GET /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const ordersRef = ref(db, 'orders');
    const orderQuery = query(ordersRef, orderByChild('order_id'), equalTo(id.toUpperCase()));
    const snapshot = await get(orderQuery);

    if (!snapshot.exists()) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const data = snapshot.val();
    const orderKey = Object.keys(data)[0];
    const existing = data[orderKey];

    const orderStatus = body.order_status ?? existing.order_status;
    const paymentStatus = body.payment_status ?? existing.payment_status;

    await update(ref(db, `orders/${orderKey}`), {
      order_status: orderStatus,
      payment_status: paymentStatus
    });

    const updatedOrder = {
      id: orderKey,
      ...existing,
      order_status: orderStatus,
      payment_status: paymentStatus
    };

    return NextResponse.json({ message: 'Order updated', order: updatedOrder });
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
