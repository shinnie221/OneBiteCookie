import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { businessDate } from '@/lib/business.mjs';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user || !['staff', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = businessDate();

    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    let allOrders = [];
    ordersSnapshot.forEach(doc => {
      allOrders.push({ id: doc.id, ...doc.data() });
    });

    allOrders = allOrders.filter(order => !order.is_manual_order);

    const productsSnapshot = await getDocs(collection(db, 'products'));
    let allProducts = [];
    productsSnapshot.forEach(doc => {
      allProducts.push({ id: doc.id, ...doc.data() });
    });

    let todaySales = 0;
    let todayOrders = 0;
    let pendingOrders = 0;
    let acceptedOrders = 0;
    let completedOrders = 0;
    let totalSales = 0;

    const acceptedStatuses = ['accepted', 'preparing', 'ready_pickup', 'out_delivery'];
    const invalidStatuses = ['rejected', 'cancelled', 'refunded'];

    for (const order of allOrders) {
      const orderDate = order.created_at ? businessDate(order.created_at) : '';
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

    // Current orders: only orders that haven't completed / been cancelled / rejected / refunded
    const activeStatuses = ['pending_verification', 'accepted', 'preparing', 'ready_pickup', 'out_delivery'];
    let currentOrders = allOrders.filter(o => activeStatuses.includes(o.order_status));

    // Current orders: sequence of ordering from oldest to latest (FIFO)
    currentOrders.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });

    // Unavailable products (cookies turned off for ordering)
    let unavailableProducts = allProducts.filter(p => p.available === false || p.available === 0);

    return NextResponse.json({
      stats: {
        todaySales,
        todayOrders,
        pendingOrders,
        acceptedOrders,
        completedOrders,
        totalSales,
        recentOrders: currentOrders,
        unavailableProducts,
        lowStockProducts: unavailableProducts // compatibility fallback
      }
    });
  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
