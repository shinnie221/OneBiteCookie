import { rtdb as db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const today = new Date().toISOString().split('T')[0];

    const ordersSnapshot = await get(ref(db, 'orders'));
    let allOrders = [];
    if (ordersSnapshot.exists()) {
      const data = ordersSnapshot.val();
      allOrders = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    }

    const productsSnapshot = await get(ref(db, 'products'));
    let allProducts = [];
    if (productsSnapshot.exists()) {
      const data = productsSnapshot.val();
      allProducts = Object.keys(data).map(key => ({ id: key, ...data[key] }));
    }

    let todaySales = 0;
    let todayOrders = 0;
    let pendingOrders = 0;
    let acceptedOrders = 0;
    let completedOrders = 0;
    let totalSales = 0;

    const acceptedStatuses = ['accepted', 'preparing', 'ready_pickup', 'out_delivery'];
    const invalidStatuses = ['rejected', 'cancelled'];

    for (const order of allOrders) {
      const orderDate = order.created_at ? order.created_at.split('T')[0] : '';
      const orderTotal = order.total || 0;

      if (orderDate === today) {
        todayOrders++;
        if (!invalidStatuses.includes(order.order_status)) {
          todaySales += orderTotal;
        }
      }

      if (order.order_status === 'pending_verification') {
        pendingOrders++;
      } else if (acceptedStatuses.includes(order.order_status)) {
        acceptedOrders++;
      } else if (order.order_status === 'completed') {
        completedOrders++;
        totalSales += orderTotal;
      }
    }

    // Recent orders (last 10)
    allOrders.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
    const recentOrders = allOrders.slice(0, 10);

    // Low stock products
    let lowStockProducts = allProducts.filter(p => p.stock <= 10 && (p.available === 1 || p.available === true));
    lowStockProducts.sort((a, b) => a.stock - b.stock);

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
