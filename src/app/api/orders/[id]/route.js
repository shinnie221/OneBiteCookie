import { getDb, queryOne, queryAll, runStmt } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = await getDb();
    
    const order = queryOne(db, 'SELECT * FROM orders WHERE order_id = ?', [id.toUpperCase()]);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    order.items = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);

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
    const db = await getDb();
    const body = await request.json();

    const existing = queryOne(db, 'SELECT * FROM orders WHERE order_id = ?', [id.toUpperCase()]);
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update allowed fields
    const orderStatus = body.order_status ?? existing.order_status;
    const paymentStatus = body.payment_status ?? existing.payment_status;

    runStmt(db,
      'UPDATE orders SET order_status = ?, payment_status = ? WHERE order_id = ?',
      [orderStatus, paymentStatus, id.toUpperCase()]
    );

    // Fetch updated order with items
    const updated = queryOne(db, 'SELECT * FROM orders WHERE order_id = ?', [id.toUpperCase()]);
    updated.items = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [updated.order_id]);

    return NextResponse.json({ message: 'Order updated', order: updated });
  } catch (error) {
    console.error('PUT /api/orders/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
