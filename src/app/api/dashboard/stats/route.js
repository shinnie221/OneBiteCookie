import { getDb, queryOne, queryAll } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];

    // Today's sales
    const todaySalesRow = queryOne(db,
      "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE date(created_at) = ? AND order_status NOT IN ('rejected', 'cancelled')",
      [today]
    );
    const todaySales = todaySalesRow?.total || 0;

    // Today's order count
    const todayOrdersRow = queryOne(db,
      "SELECT COUNT(*) as count FROM orders WHERE date(created_at) = ?",
      [today]
    );
    const todayOrders = todayOrdersRow?.count || 0;

    // Pending orders
    const pendingRow = queryOne(db,
      "SELECT COUNT(*) as count FROM orders WHERE order_status = 'pending_verification'"
    );
    const pendingOrders = pendingRow?.count || 0;

    // Accepted / active orders
    const acceptedRow = queryOne(db,
      "SELECT COUNT(*) as count FROM orders WHERE order_status IN ('accepted', 'preparing', 'ready_pickup', 'out_delivery')"
    );
    const acceptedOrders = acceptedRow?.count || 0;

    // Completed orders total
    const completedRow = queryOne(db,
      "SELECT COUNT(*) as count FROM orders WHERE order_status = 'completed'"
    );
    const completedOrders = completedRow?.count || 0;

    // Total revenue all time
    const totalSalesRow = queryOne(db,
      "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE order_status = 'completed'"
    );
    const totalSales = totalSalesRow?.total || 0;

    // Recent orders (last 10)
    const recentOrders = queryAll(db, 'SELECT * FROM orders ORDER BY id DESC LIMIT 10');

    // Low stock products
    const lowStockProducts = queryAll(db, 'SELECT * FROM products WHERE stock <= 10 AND available = 1 ORDER BY stock ASC');

    return NextResponse.json({
      stats: {
        todaySales,
        todayOrders,
        pendingOrders,
        acceptedOrders,
        completedOrders,
        totalSales,
        recentOrders,
        lowStockProducts
      }
    });
  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
