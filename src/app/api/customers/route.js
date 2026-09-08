import { db } from '@/lib/firebase';
import { collection, query as firestoreQuery, where, getDocs } from 'firebase/firestore';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { verifyAuth } = await import('@/lib/auth');
    const user = verifyAuth(request);
    
    // Only allow admin or staff
    if (!user || user.role === 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch customers from Firestore
    const usersRef = collection(db, 'users');
    const q = firestoreQuery(usersRef, where('role', '==', 'customer'));
    const usersSnapshot = await getDocs(q);

    let customers = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      const { password, ...safeData } = data;
      customers.push({
        id: doc.id,
        ...safeData
      });
    });

    // Sort by created_at DESC
    customers.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    // Fetch orders from Firestore
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    let orders = [];
    ordersSnapshot.forEach(doc => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    // Attach order details, phone, and stats to each customer
    for (let customer of customers) {
      const customerOrders = orders
        .filter(o => o.customer_id === customer.id)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      
      customer.orderCount = customerOrders.length;
      customer.totalSpent = customerOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      
      // Get phone from most recent order (if available)
      const latestOrderWithPhone = customerOrders.find(o => o.phone);
      customer.phone = customer.phone || (latestOrderWithPhone ? latestOrderWithPhone.phone : '');
      
      // Attach order history (limited info for the list)
      customer.orders = customerOrders.map(o => ({
        id: o.id,
        order_id: o.order_id,
        total: o.total,
        order_status: o.order_status,
        payment_status: o.payment_status,
        order_type: o.order_type,
        items: o.items,
        created_at: o.created_at
      }));
    }

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('GET /api/customers error:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

