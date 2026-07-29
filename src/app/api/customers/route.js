import { getDb, queryAll } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    
    // Only allow admin or staff
    if (!user || user.role === 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    
    // Fetch all customers (excluding passwords)
    const customers = queryAll(db, "SELECT id, name, email, created_at FROM users WHERE role = 'customer' ORDER BY created_at DESC");

    // Also get order counts and total spent for each customer
    for (let customer of customers) {
      const stats = queryAll(db, "SELECT COUNT(*) as orderCount, SUM(total) as totalSpent FROM orders WHERE customer_id = ?", [customer.id]);
      customer.orderCount = stats[0]?.orderCount || 0;
      customer.totalSpent = stats[0]?.totalSpent || 0;
    }

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('GET /api/customers error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
