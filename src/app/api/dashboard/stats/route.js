import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { verifyAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const user = verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const today = new Date().toISOString().split('T')[0];

    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    let allOrders = [];
    ordersSnapshot.forEach(doc => {
      allOrders.push({ id: doc.id, ...doc.data() });
    });

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

    // Status priority for sorting dashboard current orders
    const statusPriority = {
      'pending_verification': 0,
      'accepted': 1,
      'preparing': 1,
      'ready_pickup': 2,
      'out_delivery': 2,
    };

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

    // Current orders: only orders that haven't completed / been cancelled / rejected / refunded
    const activeStatuses = ['pending_verification', 'accepted', 'preparing', 'ready_pickup', 'out_delivery'];
    let currentOrders = allOrders.filter(o => activeStatuses.includes(o.order_status));
    
    // Sort by time first (ascending — oldest first), then by status priority
    currentOrders.sort((a, b) => {
      const priorityA = statusPriority[a.order_status] ?? 99;
      const priorityB = statusPriority[b.order_status] ?? 99;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Same priority — sort by time ascending (oldest first / earliest order first)
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    });

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
        recentOrders: currentOrders,
        lowStockProducts
      }
    });
  } catch (error) {
    console.error('GET /api/dashboard/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
