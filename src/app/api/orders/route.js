import { getDb, queryAll, queryOne, runStmt } from '@/lib/db';
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
    const db = await getDb();
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    let sql = 'SELECT * FROM orders';
    const conditions = [];
    const params = [];

    // Customer can only see their own orders
    if (user.role === 'customer') {
      conditions.push('customer_id = ?');
      params.push(user.id);
    }

    if (status && status !== 'all') {
      if (status === 'accepted') {
        conditions.push("order_status IN ('accepted', 'preparing', 'ready_pickup', 'out_delivery')");
      } else {
        conditions.push('order_status = ?');
        params.push(status);
      }
    }

    if (dateFrom) {
      conditions.push("date(created_at) >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push("date(created_at) <= ?");
      params.push(dateTo);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY id DESC';

    const orders = queryAll(db, sql, params);

    // Attach items to each order
    for (const order of orders) {
      order.items = queryAll(db, 'SELECT * FROM order_items WHERE order_id = ?', [order.order_id]);
    }

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('GET /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = await getDb();
    const user = verifyAuth(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customer_name, phone, email, order_type, address, items, voucher_code, payment_screenshot } = body;

    // Validate required fields
    if (!customer_name || !phone || !items || items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone, and items are required' }, { status: 400 });
    }

    // Calculate totals from server-side prices
    let subtotal = 0;
    const resolvedItems = [];
    
    for (const item of items) {
      const product = queryOne(db, 'SELECT * FROM products WHERE id = ? AND available = 1', [item.product_id]);
      if (!product) {
        return NextResponse.json({ error: `Product "${item.product_name}" is no longer available` }, { status: 400 });
      }
      if (product.stock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for "${product.name}". Only ${product.stock} available.` }, { status: 400 });
      }
      
      const itemSubtotal = product.price * item.quantity;
      subtotal += itemSubtotal;
      
      resolvedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        price: product.price,
        subtotal: itemSubtotal
      });
    }

    // Apply voucher
    let discount = 0;
    if (voucher_code) {
      const today = new Date().toISOString().split('T')[0];
      const voucher = queryOne(db, 
        "SELECT * FROM vouchers WHERE code = ? AND active = 1 AND (expiry_date IS NULL OR expiry_date >= ?)",
        [voucher_code.toUpperCase(), today]
      );
      
      if (voucher && subtotal >= voucher.min_order) {
        if (voucher.discount_type === 'percentage') {
          discount = subtotal * (voucher.discount_value / 100);
        } else {
          discount = voucher.discount_value;
        }
        discount = Math.min(discount, subtotal);
      }
    }

    const total = Math.max(0, subtotal - discount);
    const orderId = generateOrderId();

    // Insert order
    runStmt(db,
      `INSERT INTO orders (order_id, customer_id, customer_name, phone, email, order_type, address, subtotal, discount, total, voucher_code, payment_screenshot, payment_status, order_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending_verification')`,
      [orderId, user.id, customer_name, phone, email || '', order_type || 'pickup', address || '', subtotal, discount, total, voucher_code || null, payment_screenshot || null]
    );

    // Insert order items
    for (const item of resolvedItems) {
      runStmt(db,
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.product_name, item.quantity, item.price, item.subtotal]
      );
    }

    // Deduct stock
    for (const item of resolvedItems) {
      runStmt(db, 'UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    return NextResponse.json({
      message: 'Order placed successfully',
      order: { order_id: orderId, subtotal, discount, total, order_status: 'pending_verification' }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/orders error:', error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
