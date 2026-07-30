import { db } from '@/lib/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    
    // Only allow admin or staff
    if (!user || user.role === 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usersQuery = query(ref(db, 'users'), orderByChild('role'), equalTo('customer'));
    const usersSnapshot = await get(usersQuery);

    let customers = [];
    if (usersSnapshot.exists()) {
      const data = usersSnapshot.val();
      customers = Object.keys(data).map(key => {
        const { password, ...safeData } = data[key];
        return {
          id: key,
          ...safeData
        };
      });
    }

    // Sort by created_at DESC
    customers.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    const ordersSnapshot = await get(ref(db, 'orders'));
    let orders = [];
    if (ordersSnapshot.exists()) {
      const data = ordersSnapshot.val();
      orders = Object.keys(data).map(key => data[key]);
    }

    // Also get order counts and total spent for each customer
    for (let customer of customers) {
      const customerOrders = orders.filter(o => o.customer_id === customer.id);
      customer.orderCount = customerOrders.length;
      customer.totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);
    }

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('GET /api/customers error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
